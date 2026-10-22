
import logging
import time

from fastapi import ( APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile,)
from sqlalchemy import insert, update
from sqlalchemy.orm import Session
from app.core import ttl_cache
from app.api.deps import get_db, get_current_user
from app.core.scope import DataScope, get_data_scope
from app.ml.models.audit_log import AuditLog
from app.ml.models.user import User
from app.models.alert import Alert
from app.models.log_entry import LogEntry
from app.models.upload import Upload
from app.schemas.log import LogListResponse, LogUploadResponse
from app.services import ml_service, rule_engine_service
from app.services.alert_investigation_service import (
    investigate_alerts_batch,
)
from app.services.log_parser_service import parse_file_content
from app.services.normalization_service import normalize

router = APIRouter(prefix="/logs", tags=["Logs"])
logger = logging.getLogger("siem.upload")

LOG_BATCH_SIZE = 10_000
INVESTIGATION_BATCH_SIZE = 500
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
ALLOWED_EXTENSIONS = (".log", ".txt", ".csv", ".json")


@router.post("/upload", response_model=LogUploadResponse)
async def upload_logs(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start_time = time.perf_counter()
    filename = file.filename or "uploaded-log"

    try:
        if not filename.lower().endswith(ALLOWED_EXTENSIONS):
            raise HTTPException(status_code=400, detail="Unsupported file type. Use .log, .txt, .csv, or .json",  )

        content_bytes = await file.read(MAX_UPLOAD_BYTES + 1)

        if len(content_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds the 100 MiB upload limit",)
        
        if not content_bytes:
            raise HTTPException(status_code=400, detail="The uploaded file is empty",)

        logger.info(
            "Uploaded filename=%s size=%s bytes user=%s",
            filename,
            len(content_bytes),
            current_user.username,
        )

        try:
            content = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = content_bytes.decode("latin-1")

        parse_start = time.perf_counter()
        parsed_lines = parse_file_content(content, filename)
        parse_time = time.perf_counter() - parse_start

        if not parsed_lines:
            raise HTTPException(
                status_code=400,
                detail="No parseable log lines found in this file",
            )

        normalize_start = time.perf_counter()
        normalized_rows = []
        failed = 0

        for parsed in parsed_lines:
            try:
                normalized_rows.append(normalize(parsed))
            except Exception:
                failed += 1
                logger.debug(
                    "Could not normalize a parsed log line",
                    exc_info=True,
                )

        normalize_time = time.perf_counter() - normalize_start
        del parsed_lines

        if not normalized_rows:
            raise HTTPException(
                status_code=400,
                detail="No valid logs could be normalized",
            )

        upload = Upload(
            username=current_user.username,
            filename=filename,
        )
        db.add(upload)
        db.flush()
        upload_id = upload.id

        saved = 0
        alerts_created = 0
        investigation_ids = []

        insert_logs_time = 0.0
        rule_engine_time = 0.0
        ml_engine_time = 0.0
        insert_alerts_time = 0.0

        try:
            for batch_start in range(
                0,
                len(normalized_rows),
                LOG_BATCH_SIZE,
            ):
                batch_end = min(
                    batch_start + LOG_BATCH_SIZE,
                    len(normalized_rows),
                )
                batch = normalized_rows[batch_start:batch_end]

                logger.info(
                    "Processing records %s-%s of %s for upload %s",
                    batch_start + 1,
                    batch_end,
                    len(normalized_rows),
                    upload_id,
                )

                # Insert log records.
                stage_start = time.perf_counter()
                result = db.execute(
                    insert(LogEntry).returning(LogEntry.id),
                    [
                        {**row, "upload_id": upload_id}
                        for row in batch
                    ],
                )
                log_ids = [row[0] for row in result]
                saved += len(log_ids)
                insert_logs_time += time.perf_counter() - stage_start

                # Run rule-based detection.
                stage_start = time.perf_counter()
                rule_alerts = rule_engine_service.evaluate_batch(
                    batch,
                    log_ids,
                )
                rule_engine_time += time.perf_counter() - stage_start

                already_flagged = {
                    alert["log_id"] for alert in rule_alerts
                }

                # Run ML detection on logs not already flagged.
                stage_start = time.perf_counter()
                ml_alerts = ml_service.evaluate_batch(
                    batch,
                    log_ids,
                    skip_ids=already_flagged,
                )
                ml_engine_time += time.perf_counter() - stage_start

                all_alerts = rule_alerts + ml_alerts

                if all_alerts:
                    stage_start = time.perf_counter()
                    result = db.execute(
                        insert(Alert).returning(Alert.id),
                        [
                            {**alert, "upload_id": upload_id}
                            for alert in all_alerts
                        ],
                    )
                    new_alert_ids = [row[0] for row in result]
                    alerts_created += len(new_alert_ids)
                    investigation_ids.extend(new_alert_ids)
                    insert_alerts_time += (
                        time.perf_counter() - stage_start
                    )

                # Update upload statistics in the same transaction
                # as this batch's logs and alerts.
                db.execute(
                    update(Upload)
                    .where(Upload.id == upload_id)
                    .values(
                        logs_parsed=saved,
                        alerts_created=alerts_created,
                    )
                )
                db.commit()

        except Exception as exc:
            db.rollback()
            logger.exception(
                "Failed processing upload %s near record %s",
                upload_id,
                batch_start + 1,
            )
            # Earlier batches may already be committed.
            ttl_cache.invalidate_prefix("summary:")
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed while processing a log batch. "
                    "Check backend logs for details."
                ),
            ) from exc

        # Record the completed ingestion in the audit log.
        try:
            db.add(
                AuditLog(
                    user=current_user.username,
                    action="upload_logs",
                    target=filename,
                )
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.exception(
                "Failed to store audit log for upload %s",
                upload_id,
            )
            raise HTTPException(
                status_code=500,
                detail=(
                    "Logs were processed, but audit information "
                    "could not be stored."
                ),
            ) from exc

        # Refresh dashboard summaries after successful ingestion.
        ttl_cache.invalidate_prefix("summary:")

        # Schedule investigation after the database writes have committed.
        for start in range(
            0,
            len(investigation_ids),
            INVESTIGATION_BATCH_SIZE,
        ):
            background_tasks.add_task(
                investigate_alerts_batch,
                investigation_ids[
                    start:start + INVESTIGATION_BATCH_SIZE
                ],
            )

        total_time = time.perf_counter() - start_time

        logger.info(
            "UPLOAD TIMING [%s] total=%.2fs parse=%.2fs "
            "normalize=%.2fs insert_logs=%.2fs rule_engine=%.2fs "
            "ml_engine=%.2fs insert_alerts=%.2fs rows=%s "
            "alerts=%s failed=%s",
            filename,
            total_time,
            parse_time,
            normalize_time,
            insert_logs_time,
            rule_engine_time,
            ml_engine_time,
            insert_alerts_time,
            saved,
            alerts_created,
            failed,
        )

        return LogUploadResponse(
            message=(
                "Logs ingested, normalized, and evaluated by "
                "the rule and ML engines. Automatic investigation "
                "has been scheduled in the background."
            ),
            filename=filename,
            logs_parsed=saved,
            logs_failed=failed,
            alerts_created=alerts_created,
        )

    finally:
        await file.close()


@router.get("", response_model=LogListResponse)
def get_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    severity: str | None = None,
    platform: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: DataScope = Depends(get_data_scope),
):
    """Retrieve paginated logs limited to the user's visible uploads."""

    if not scope.unrestricted and scope.logs == 0:
        return LogListResponse(total=0, logs=[])

    query = db.query(LogEntry)

    if not scope.unrestricted:
        query = query.filter(
            LogEntry.upload_id.in_(scope.upload_ids)
        )

    if severity:
        query = query.filter(LogEntry.severity == severity)

    if platform:
        query = query.filter(LogEntry.platform == platform)

    if not scope.unrestricted and not severity and not platform:
        total = scope.logs
    else:
        total = query.count()

    logs = (
        query.order_by(LogEntry.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return LogListResponse(total=total, logs=logs)

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import get_current_user, get_session_started
from app.db.postgres import get_db
from app.ml.models.user import User
from app.models.upload import Upload


@dataclass(frozen=True)
class DataScope:
    mode: str
    upload_ids: Optional[List[int]]  # None means no filter (mode "all")
    logs: int
    alerts: int
    key: str

    @property
    def unrestricted(self) -> bool:
        return self.upload_ids is None

    @property
    def is_empty(self) -> bool:
        return self.upload_ids is not None and len(self.upload_ids) == 0


def get_data_scope(
    user: User = Depends(get_current_user),
    started: datetime = Depends(get_session_started),
    db: Session = Depends(get_db),
) -> DataScope:
    """
    Determine which uploads the current user may access.

    session: uploads created during the current sign-in
    user:    all uploads belonging to the signed-in user
    all:     unrestricted access to uploads
    """
    mode = getattr(settings, "DATA_SCOPE", "session")

    if mode not in {"session", "user", "all"}:
        raise ValueError(
            f"Invalid DATA_SCOPE value: {mode!r}. "
            "Expected 'session', 'user', or 'all'."
        )

    if mode == "all":
        return DataScope(
            mode="all",
            upload_ids=None,
            logs=0,
            alerts=0,
            key="all",
        )

    stmt = select(
        Upload.id,
        Upload.logs_parsed,
        Upload.alerts_created,
    ).where(
        Upload.username == user.username
    )

    if mode == "session":
        stmt = stmt.where(Upload.created_at >= started)

    rows = db.execute(stmt.order_by(Upload.id)).all()

    upload_ids = [row.id for row in rows]

    total_logs = sum(row.logs_parsed or 0 for row in rows)
    total_alerts = sum(row.alerts_created or 0 for row in rows)

    return DataScope(
        mode=mode,
        upload_ids=upload_ids,
        logs=total_logs,
        alerts=total_alerts,
        key=f"{mode}:{user.id}:{','.join(map(str, upload_ids))}",
    )

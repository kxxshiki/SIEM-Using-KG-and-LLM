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
    upload_ids: Optional[List[int]]   # None means no filter (mode "all")
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
    """Which uploads this user may see. One tiny query on the `uploads` table."""
    mode = settings.DATA_SCOPE
    if mode == "all":
        return DataScope("all", None, 0, 0, "all")
    stmt = select(Upload.id, Upload.logs_parsed, Upload.alerts_created).where(
        Upload.username == user.username
    )
    if mode == "session":
        stmt = stmt.where(Upload.created_at >= started)
    rows = db.execute(stmt.order_by(Upload.id)).all()
    ids = [r.id for r in rows]
    return DataScope(
        mode, ids, sum(r.logs_parsed for r in rows), sum(r.alerts_created for r in rows),
        f"{mode}:{user.id}:{','.join(map(str, ids))}",
    )
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import literal, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.postgres import get_db
from app.ml.models.user import User
from app.models.log_entry import LogEntry

router = APIRouter(prefix="/data", tags=["Data status"])


class DataStatus(BaseModel):
    has_logs: bool


@router.get("/status", response_model=DataStatus)
def data_status(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """True if at least one log exists. Stops at the first row, so it stays fast on large tables."""
    row = db.execute(select(literal(1)).select_from(LogEntry).limit(1)).first()
    return DataStatus(has_logs=row is not None)
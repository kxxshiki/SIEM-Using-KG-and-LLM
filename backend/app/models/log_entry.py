
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.db.base import Base


class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    source = Column(String, index=True)
    event_type = Column(String, index=True)
    username = Column(String, index=True)
    ip_address = Column(String, index=True)

    device = Column(String, nullable=True)
    severity = Column(String, index=True)
    platform = Column(String, nullable=True)
    country = Column(String, nullable=True)

    raw_log = Column(Text)
    source_file = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Link each log entry to its upload record.
    # Nullable to preserve compatibility with existing logs.
    upload_id = Column(
        Integer,
        ForeignKey("uploads.id"),
        nullable=True,
        index=True,
    )

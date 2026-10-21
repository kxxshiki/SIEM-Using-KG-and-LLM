from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String

from app.db.base import Base


class Upload(Base):
    """One row per log upload. Used to decide which data a user's pages show."""

    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False)
    filename = Column(String, nullable=True)
    logs_parsed = Column(Integer, nullable=False, default=0)
    alerts_created = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (Index("ix_uploads_user_created", "username", "created_at"),)
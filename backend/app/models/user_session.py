from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String

from app.db.base import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(64), primary_key=True)  # opaque session ID stored in the signed JWT
    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_agent = Column(String(512), nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    __table_args__ = (Index("ix_user_sessions_active", "user_id", "revoked_at", "expires_at"),)

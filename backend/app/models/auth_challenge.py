from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, text

from app.db.base import Base


class AuthChallenge(Base):
    __tablename__ = "auth_challenges"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    purpose = Column(String(32), nullable=False)   # email_link | email_otp | phone_otp | password_reset
    code_hash = Column(String(64), nullable=False)  # HMAC-SHA256 hex
    sent_to = Column(String(255), nullable=True)
    attempts = Column(Integer, nullable=False, default=0, server_default=text("0"))
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_auth_challenges_user_purpose", "user_id", "purpose"),
        Index("ix_auth_challenges_code_hash", "code_hash"),
    )
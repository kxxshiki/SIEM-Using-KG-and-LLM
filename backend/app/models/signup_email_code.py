from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, text

from app.db.base import Base


class SignupEmailCode(Base):
    """Email codes for people who do not have an account yet (register page 'Send code')."""

    __tablename__ = "signup_email_codes"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False)
    code_hash = Column(String(64), nullable=False)       # HMAC-SHA256 hex, never the raw code
    attempts = Column(Integer, nullable=False, default=0, server_default=text("0"))
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (Index("ix_signup_email_codes_email", "email"),)
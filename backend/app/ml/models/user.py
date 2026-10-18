from datetime import datetime
import enum

from sqlalchemy import Column, DateTime, Enum, Index, Integer, String, func, text

from app.db.base import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    analyst = "analyst"


class UserStatus(str, enum.Enum):
    pending = "pending"
    awaiting_approval = "awaiting_approval"
    active = "active"
    disabled = "disabled"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.analyst, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # --- added for registration / verification ---
    full_name = Column(String(120), nullable=True)
    phone_e164 = Column(String(20), unique=True, index=True, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)
    phone_verified_at = Column(DateTime, nullable=True)
    status = Column(
        String(20), nullable=False,
        default=UserStatus.pending.value, server_default=UserStatus.pending.value,
    )
    # Bumped on password reset / logout; old JWTs carrying an older number die.
    token_version = Column(Integer, nullable=False, default=0, server_default=text("0"))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Case-insensitive uniqueness: "A@x.com" and "a@x.com" are the same account.
Index("uq_users_email_lower", func.lower(User.email), unique=True)
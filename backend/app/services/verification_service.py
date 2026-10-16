import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.ml.models.user import User, UserStatus
from app.models.auth_challenge import AuthChallenge

EMAIL_LINK = "email_link"
EMAIL_OTP = "email_otp"
PHONE_OTP = "phone_otp"
PASSWORD_RESET = "password_reset"


class OtpResult(str, Enum):
    ok = "ok"
    invalid = "invalid"
    expired = "expired"   # none active, expired, or already used
    locked = "locked"     # too many wrong attempts


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _digest(purpose: str, value: str, user_id: Optional[int] = None) -> str:
    # Keyed hash: a leaked database alone cannot be used to recover 6-digit codes.
    msg = f"{purpose}:{user_id or ''}:{value}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def invalidate_active(db: Session, user_id: int, purpose: str) -> None:
    db.execute(
        update(AuthChallenge)
        .where(AuthChallenge.user_id == user_id, AuthChallenge.purpose == purpose,
               AuthChallenge.consumed_at.is_(None))
        .values(consumed_at=utcnow())
    )


def issue_otp(db: Session, user: User, purpose: str, sent_to: str) -> str:
    invalidate_active(db, user.id, purpose)
    code = f"{secrets.randbelow(10**6):06d}"
    db.add(AuthChallenge(
        user_id=user.id, purpose=purpose, code_hash=_digest(purpose, code, user.id),
        sent_to=sent_to, expires_at=utcnow() + timedelta(seconds=settings.OTP_TTL_SECONDS),
    ))
    db.flush()
    return code


def issue_link_token(db: Session, user: User, purpose: str, ttl_minutes: int, sent_to: str) -> str:
    invalidate_active(db, user.id, purpose)
    token = secrets.token_urlsafe(32)
    db.add(AuthChallenge(
        user_id=user.id, purpose=purpose, code_hash=_digest(purpose, token),
        sent_to=sent_to, expires_at=utcnow() + timedelta(minutes=ttl_minutes),
    ))
    db.flush()
    return token


def verify_otp(db: Session, user_id: int, purpose: str, code: str) -> OtpResult:
    """On OK the challenge is marked used but NOT committed; the caller commits together
    with the user update so both succeed or both fail."""
    ch = db.execute(
        select(AuthChallenge)
        .where(AuthChallenge.user_id == user_id, AuthChallenge.purpose == purpose,
               AuthChallenge.consumed_at.is_(None))
        .order_by(AuthChallenge.created_at.desc()).limit(1)
        .with_for_update()                       # serialises concurrent guesses
    ).scalar_one_or_none()
    if ch is None:
        return OtpResult.expired
    now = utcnow()
    if ch.expires_at <= now:
        ch.consumed_at = now
        db.commit()
        return OtpResult.expired
    if hmac.compare_digest(ch.code_hash, _digest(purpose, code, user_id)):
        ch.consumed_at = now
        return OtpResult.ok
    ch.attempts += 1
    locked = ch.attempts >= settings.OTP_MAX_ATTEMPTS
    if locked:
        ch.consumed_at = now
    db.commit()
    return OtpResult.locked if locked else OtpResult.invalid


def _link_query(purpose: str, token: str):
    return select(AuthChallenge).where(
        AuthChallenge.purpose == purpose,
        AuthChallenge.code_hash == _digest(purpose, token),
        AuthChallenge.consumed_at.is_(None),
        AuthChallenge.expires_at > utcnow(),
    )


def peek_link(db: Session, purpose: str, token: str) -> Optional[AuthChallenge]:
    return db.execute(_link_query(purpose, token)).scalar_one_or_none()


def consume_link(db: Session, purpose: str, token: str) -> Optional[AuthChallenge]:
    """Single use. Row-locked, so two simultaneous clicks cannot both succeed."""
    ch = db.execute(_link_query(purpose, token).with_for_update()).scalar_one_or_none()
    if ch is not None:
        ch.consumed_at = utcnow()
    return ch


def lock_user(db: Session, user_id: int) -> User:
    return db.execute(select(User).where(User.id == user_id).with_for_update()).scalar_one()


def mark_verified(db: Session, user_id: int, channel: str) -> User:
    """Set the verified timestamp and activate only when BOTH channels are verified."""
    user = lock_user(db, user_id)
    now = utcnow()
    if channel == "email" and not user.email_verified_at:
        user.email_verified_at = now
    if channel == "phone" and not user.phone_verified_at:
        user.phone_verified_at = now
    if (user.status == UserStatus.pending.value
            and user.email_verified_at and user.phone_verified_at):
        user.status = UserStatus.active.value
    return user
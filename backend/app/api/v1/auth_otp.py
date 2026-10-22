
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core import limiter
from app.core.phone import normalize_phone_for_login
from app.core.security import (
    DUMMY_HASH,
    create_user_session,
    verify_and_update,
    verify_password,
)
from app.db.base import Base
from app.db.postgres import get_db
from app.ml.models.audit_log import AuditLog
from app.ml.models.user import User, UserStatus
from app.services import delivery_service as delivery
from app.services import verification_service as vs

log = logging.getLogger("siem.auth.otp")
router = APIRouter(prefix="/auth/otp", tags=["OTP Login"])

LOGIN_EMAIL_OTP = "login_email_otp"
LOGIN_PHONE_OTP = "login_phone_otp"
CHALLENGE_TTL_MINUTES = 5


class OTPLoginChallenge(Base):
    __tablename__ = "otp_login_challenges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email_verified = Column(Boolean, nullable=False, default=False)
    phone_verified = Column(Boolean, nullable=False, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=vs.utcnow)


class OTPStartRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class OTPCodeRequest(BaseModel):
    challenge_id: int
    code: str = Field(pattern=r"^\d{6}$")


class OTPFinishRequest(BaseModel):
    challenge_id: int


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _find_user(db: Session, identifier: str):
    identifier = identifier.strip()

    if "@" in identifier:
        from sqlalchemy import func

        return db.execute(
            select(User).where(func.lower(User.email) == identifier.lower())
        ).scalar_one_or_none()

    phone = normalize_phone_for_login(
        identifier, settings.PHONE_DEFAULT_REGION
    )
    if phone:
        user = db.execute(
            select(User).where(User.phone_e164 == phone)
        ).scalar_one_or_none()
        if user:
            return user

    # Preserve compatibility with your existing username-based login.
    return db.execute(
        select(User).where(User.username == identifier)
    ).scalar_one_or_none()


def _challenge_or_400(db: Session, challenge_id: int):
    challenge = db.execute(
        select(OTPLoginChallenge)
        .where(OTPLoginChallenge.id == challenge_id)
        .with_for_update()
    ).scalar_one_or_none()

    if challenge is None:
        raise HTTPException(400, "Invalid or expired login challenge")

    if challenge.expires_at <= vs.utcnow():
        db.delete(challenge)
        db.commit()
        raise HTTPException(400, "Invalid or expired login challenge")

    return challenge


def _send_login_email(email: str, code: str):
    subject = "Your SIEM login verification code"
    text = (
        f"Your login verification code is {code}.\n"
        f"It expires in {CHALLENGE_TTL_MINUTES} minutes.\n"
        "If you did not request this code, ignore this message."
    )
    html = (
        "<p>Your SIEM login verification code is:</p>"
        f"<h2>{code}</h2>"
        f"<p>It expires in {CHALLENGE_TTL_MINUTES} minutes.</p>"
        "<p>If you did not request this code, ignore this message.</p>"
    )

    delivery.send_email(email, subject, text, html)


def _send_login_sms(phone: str, code: str):
    delivery.send_sms_otp(phone, code)


def _invalidate_login_codes(db: Session, user_id: int):
    vs.invalidate_active(db, user_id, LOGIN_EMAIL_OTP)
    vs.invalidate_active(db, user_id, LOGIN_PHONE_OTP)


@router.post("/start")
def start_login(
    payload: OTPStartRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    identifier = payload.identifier.strip()
    phone = normalize_phone_for_login(
        identifier, settings.PHONE_DEFAULT_REGION
    )
    account_key = phone or identifier.lower()
    ip = _ip(request)

    account_limit = f"otp-login:start:account:{account_key}"
    ip_limit = f"otp-login:start:ip:{ip}"

    if (
        limiter.count(account_limit) >= settings.LOGIN_MAX_ATTEMPTS
        or limiter.count(ip_limit) >= settings.LOGIN_MAX_ATTEMPTS * 4
    ):
        raise HTTPException(
            429,
            "Too many requests. Please try again later.",
            headers={
                "Retry-After": str(
                    max(limiter.ttl(account_limit), limiter.ttl(ip_limit), 1)
                )
            },
        )

    user = _find_user(db, identifier)

    if user:
        valid, new_hash = verify_and_update(
            payload.password, user.hashed_password
        )
    else:
        verify_password(payload.password, DUMMY_HASH)
        valid, new_hash = False, None

    if not valid:
        limiter.hit(account_limit, settings.LOGIN_WINDOW_SECONDS)
        limiter.hit(ip_limit, settings.LOGIN_WINDOW_SECONDS)
        raise HTTPException(401, "Incorrect username/email/phone or password")

    if user.status == UserStatus.disabled.value:
        raise HTTPException(403, "This account is disabled")

    if user.status != UserStatus.active.value:
        raise HTTPException(
            403,
            "Your account must be verified and approved before signing in.",
        )

    if not user.email or not user.phone_e164:
        raise HTTPException(
            403,
            "Both a registered email and phone number are required.",
        )

    if not user.email_verified_at or not user.phone_verified_at:
        raise HTTPException(
            403,
            "Verify your registered email and phone before signing in.",
        )

    if new_hash:
        user.hashed_password = new_hash

    # Invalidate previous pending login challenges for this user.
    db.query(OTPLoginChallenge).filter(
        OTPLoginChallenge.user_id == user.id
    ).delete(synchronize_session=False)
    _invalidate_login_codes(db, user.id)

    challenge = OTPLoginChallenge(
        user_id=user.id,
        email_verified=False,
        phone_verified=False,
        expires_at=vs.utcnow() + timedelta(minutes=CHALLENGE_TTL_MINUTES),
    )
    db.add(challenge)

    email_code = vs.issue_otp(
        db, user, LOGIN_EMAIL_OTP, user.email
    )
    phone_code = vs.issue_otp(
        db, user, LOGIN_PHONE_OTP, user.phone_e164
    )

    # Persist challenge and OTP hashes before attempting delivery.
    db.commit()
    db.refresh(challenge)

    try:
        _send_login_email(user.email, email_code)
        _send_login_sms(user.phone_e164, phone_code)
    except delivery.DeliveryError:
        log.warning("Login OTP delivery failed")
        _invalidate_login_codes(db, user.id)
        db.delete(challenge)
        db.commit()
        raise HTTPException(
            503,
            "Could not deliver both verification codes. Please try again.",
        )
    except Exception:
        log.exception("Unexpected login OTP delivery error")
        _invalidate_login_codes(db, user.id)
        db.delete(challenge)
        db.commit()
        raise HTTPException(
            503,
            "Could not deliver both verification codes. Please try again.",
        )

    return {
        "message": "Codes sent to your registered email and phone.",
        "challenge_id": challenge.id,
        "expires_in_seconds": CHALLENGE_TTL_MINUTES * 60,
    }


@router.post("/verify-email")
def verify_email(
    payload: OTPCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = _ip(request)
    if limiter.hit(f"otp-login:verify:ip:{ip}", 600) > 30:
        raise HTTPException(429, "Too many verification attempts")

    challenge = _challenge_or_400(db, payload.challenge_id)

    if challenge.email_verified:
        raise HTTPException(409, "Email code already verified")

    user = db.get(User, challenge.user_id)
    if user is None:
        raise HTTPException(400, "Invalid login challenge")

    result = vs.verify_otp(
        db, user.id, LOGIN_EMAIL_OTP, payload.code
    )
    if result is not vs.OtpResult.ok:
        # The OTP service commits failed-attempt counters itself.
        db.rollback()
        raise HTTPException(400, "Invalid, expired, or locked email code")

    challenge.email_verified = True
    db.commit()

    return {"verified": True, "message": "Email OTP verified"}


@router.post("/verify-phone")
def verify_phone(
    payload: OTPCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = _ip(request)
    if limiter.hit(f"otp-login:verify:ip:{ip}", 600) > 30:
        raise HTTPException(429, "Too many verification attempts")

    challenge = _challenge_or_400(db, payload.challenge_id)

    if challenge.phone_verified:
        raise HTTPException(409, "Phone code already verified")

    user = db.get(User, challenge.user_id)
    if user is None:
        raise HTTPException(400, "Invalid login challenge")

    result = vs.verify_otp(
        db, user.id, LOGIN_PHONE_OTP, payload.code
    )
    if result is not vs.OtpResult.ok:
        db.rollback()
        raise HTTPException(400, "Invalid, expired, or locked phone code")

    challenge.phone_verified = True
    db.commit()

    return {"verified": True, "message": "Phone OTP verified"}


@router.post("/finish")
def finish_login(
    payload: OTPFinishRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    challenge = _challenge_or_400(db, payload.challenge_id)

    if not challenge.email_verified or not challenge.phone_verified:
        raise HTTPException(
            403, "Both email and phone OTPs must be verified."
        )

    user = db.execute(
        select(User)
        .where(User.id == challenge.user_id)
        .with_for_update()
    ).scalar_one_or_none()

    if (
        user is None
        or user.status != UserStatus.active.value
        or not user.email_verified_at
        or not user.phone_verified_at
    ):
        raise HTTPException(403, "This account cannot sign in")

    token = create_user_session(db, user, request)

    db.add(
        AuditLog(
            user=user.username,
            action="login",
            target=None,
        )
    )

    db.delete(challenge)
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role.value,
    }

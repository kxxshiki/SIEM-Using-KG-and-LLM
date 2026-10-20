import logging
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List 
from typing import Optional    

from app.config import settings
from app.core import limiter
from app.core.phone import normalize_phone_for_login
from app.core.password_policy import password_problems
from app.core.security import (
    DUMMY_HASH, create_access_token, create_verification_token, get_current_user,
    get_password_hash, get_verifying_user, require_admin, verify_and_update, verify_password,
)
from app.db.postgres import get_db
from app.ml.models.audit_log import AuditLog
from app.ml.models.user import User, UserRole, UserStatus
from app.schemas.account import (
    AuthOptions, EmailProofResponse, EmailRequest, ForgotPasswordRequest, MessageResponse,
    OtpRequest, PendingUserOut, PhoneLoginSend, PhoneLoginVerify, RegisterRequest,
    RegisterResponse, ResetPasswordRequest, SignupCodeVerify, TokenRequest, TokenValidity,
    VerificationStatus, VerifyResult,
)
from app.services import oauth_service as oa
from app.schemas.auth import Token, UserOut
from app.services import delivery_service as delivery
from app.services import verification_service as vs

log = logging.getLogger("siem.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---------- helpers ----------
def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _too_many(retry_after: int = 60) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Too many requests. Please try again later.",
        headers={"Retry-After": str(max(retry_after, 1))},
    )


def _next_step(user: User) -> str:
    if user.status == UserStatus.active.value:
        return "done"
    if not user.email_verified_at:
        return "verify_email"
    if not user.phone_verified_at:
        return "verify_phone"
    if user.status == UserStatus.awaiting_approval.value:
        return "awaiting_approval"
    return "done"


def _mask_email(e: str) -> str:
    name, _, domain = e.partition("@")
    return f"{name[:1]}***@{domain}"


def _mask_phone(p: str) -> str:
    return f"{'*' * max(len(p) - 4, 0)}{p[-4:]}" if p else ""


def _status_view(user: User) -> VerificationStatus:
    return VerificationStatus(
        status=user.status,
        email_verified=bool(user.email_verified_at),
        phone_verified=bool(user.phone_verified_at),
        email_masked=_mask_email(user.email),
        phone_masked=_mask_phone(user.phone_e164 or ""),
        next_step=_next_step(user),
    )


def _issue_and_send_email(db: Session, user: User) -> None:
    """Create link + OTP and send ONE email carrying both. Raises DeliveryError."""
    token = vs.issue_link_token(db, user, vs.EMAIL_LINK, settings.EMAIL_LINK_TTL_MINUTES, user.email)
    otp = vs.issue_otp(db, user, vs.EMAIL_OTP, user.email)
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject, text, body = delivery.verification_email(user.full_name or user.username, otp, link)
    delivery.send_email(user.email, subject, text, body)


def _canonical_ident(ident: str) -> str:
    """One stable key per account, so '+91 98765 43210' and '919876543210' share one lockout counter."""
    phone = normalize_phone_for_login(ident, settings.PHONE_DEFAULT_REGION)
    return phone if phone else ident.lower()


def _find_user(db: Session, ident: str):
    if "@" in ident:
        return db.execute(
            select(User).where(func.lower(User.email) == ident.lower())
        ).scalar_one_or_none()
    phone = normalize_phone_for_login(ident, settings.PHONE_DEFAULT_REGION)
    if phone:
        user = db.execute(select(User).where(User.phone_e164 == phone)).scalar_one_or_none()
        if user is not None:
            return user
    return db.execute(select(User).where(User.username == ident)).scalar_one_or_none()

# ---------- registration ----------
@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if limiter.hit(f"register:ip:{_ip(request)}", 3600) > 5:
        raise _too_many(limiter.ttl(f"register:ip:{_ip(request)}"))

    # The email must have been verified on the register page first.
    if vs.read_email_proof(payload.email_proof) != payload.email:
        raise HTTPException(400, "Email verification expired. Please verify your email again")

    duplicate = db.execute(
        select(User.id).where(or_(
            User.username == payload.username,
            func.lower(User.email) == payload.email,
            User.phone_e164 == payload.phone,
        )).limit(1)
    ).first()
    if duplicate:
        raise HTTPException(409, "An account with this username, email or phone already exists")

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        phone_e164=payload.phone,
        hashed_password=get_password_hash(payload.password),
        role=UserRole.analyst,                     # never taken from the request
        status=UserStatus.pending.value,           # still pending: phone + admin approval remain
        email_verified_at=vs.utcnow(),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:                         # lost a race with a parallel signup
        db.rollback()
        raise HTTPException(409, "An account with this username, email or phone already exists")
    db.commit()

    return RegisterResponse(
        message="Account created. Now verify your phone number.",
        verification_token=create_verification_token(user),
        next_step="verify_phone",
    )


# ---------- login ----------
@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ident = form_data.username.strip()
    ip = _ip(request)

    acct_key = f"login:fail:acct:{_canonical_ident(ident)}"
    ip_key = f"login:fail:ip:{ip}"

    if (
        limiter.count(acct_key) >= settings.LOGIN_MAX_ATTEMPTS
        or limiter.count(ip_key) >= settings.LOGIN_MAX_ATTEMPTS * 4
    ):
        raise _too_many(
            max(limiter.ttl(acct_key), limiter.ttl(ip_key))
        )

    user = _find_user(db, ident)

    if user is not None:
        valid, new_hash = verify_and_update(
            form_data.password,
            user.hashed_password,
        )
    else:
        verify_password(form_data.password, DUMMY_HASH)
        valid, new_hash = False, None

    if not valid:
        limiter.hit(acct_key, settings.LOGIN_WINDOW_SECONDS)
        limiter.hit(ip_key, settings.LOGIN_WINDOW_SECONDS)

        if user is not None:
            db.add(
                AuditLog(
                    user=user.username,
                    action="login_failed",
                    target=None,
                )
            )
            db.commit()

        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
        )

    if user.status == UserStatus.disabled.value:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "account_disabled",
                "message": "This account is disabled.",
            },
        )

    if user.status == UserStatus.pending.value:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "verification_required",
                "message": "Verify your email and phone to activate this account.",
                "email_verified": bool(user.email_verified_at),
                "phone_verified": bool(user.phone_verified_at),
                "next_step": _next_step(user),
                "verification_token": create_verification_token(user),
            },
        )

    if user.status == UserStatus.awaiting_approval.value:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "approval_required",
                "message": "Your account is verified and waiting for administrator approval.",
            },
        )

    limiter.reset(acct_key)
    limiter.reset(ip_key)

    if new_hash:
        user.hashed_password = new_hash

    token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role.value,
            "tv": user.token_version,
        },
        expires_delta=timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    )

    db.add(
        AuditLog(
            user=user.username,
            action="login",
            target=None,
        )
    )
    db.commit()

    return Token(
        access_token=token,
        username=user.username,
        role=user.role,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=204)
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Invalidates ALL tokens of this user (every device)."""
    current_user.token_version += 1
    db.add(AuditLog(user=current_user.username, action="logout", target=None))
    db.commit()


# ---------- verification ----------
@router.get("/verification-status", response_model=VerificationStatus)
def verification_status(user: User = Depends(get_verifying_user)):
    return _status_view(user)


@router.post("/verify-email-link", response_model=VerifyResult)
def verify_email_link(payload: TokenRequest, request: Request, db: Session = Depends(get_db)):
    if limiter.hit(f"verify:ip:{_ip(request)}", 600) > 20:
        raise _too_many()
    ch = vs.consume_link(db, vs.EMAIL_LINK, payload.token)
    if ch is None:
        raise HTTPException(400, "This link is invalid, expired or already used")
    user = vs.mark_verified(db, ch.user_id, "email")
    vs.invalidate_active(db, user.id, vs.EMAIL_OTP)
    db.commit()
    return VerifyResult(verified=True, next_step=_next_step(user), message="Email verified")


@router.post("/verify-email-otp", response_model=VerifyResult)
def verify_email_otp(payload: OtpRequest, request: Request,
                     user: User = Depends(get_verifying_user), db: Session = Depends(get_db)):
    if limiter.hit(f"verify:ip:{_ip(request)}", 600) > 30:
        raise _too_many()
    if user.email_verified_at:
        raise HTTPException(409, "Email is already verified")
    result = vs.verify_otp(db, user.id, vs.EMAIL_OTP, payload.code)
    if result is not vs.OtpResult.ok:
        msg = {vs.OtpResult.invalid: "Incorrect code",
               vs.OtpResult.expired: "Code expired or not found. Request a new one",
               vs.OtpResult.locked: "Too many wrong attempts. Request a new code"}[result]
        raise HTTPException(400, msg)
    user = vs.mark_verified(db, user.id, "email")
    vs.invalidate_active(db, user.id, vs.EMAIL_LINK)
    db.commit()
    return VerifyResult(verified=True, next_step=_next_step(user), message="Email verified")


@router.post("/resend-email", response_model=MessageResponse)
def resend_email(user: User = Depends(get_verifying_user), db: Session = Depends(get_db)):
    if user.email_verified_at:
        raise HTTPException(409, "Email is already verified")
    cd = f"cd:email:{user.id}"
    if limiter.hit(f"resend:email:{user.id}", 3600) > 5:
        raise _too_many(limiter.ttl(f"resend:email:{user.id}"))
    if not limiter.acquire(cd, settings.OTP_RESEND_COOLDOWN_SECONDS):
        raise _too_many(limiter.ttl(cd))
    try:
        _issue_and_send_email(db, user)
        db.commit()
    except delivery.DeliveryError:
        db.rollback()
        limiter.release(cd)
        raise HTTPException(503, "Could not send the email. Please try again later")
    return MessageResponse(message="Verification email sent")


@router.post("/send-phone-otp", response_model=MessageResponse)
def send_phone_otp(request: Request, user: User = Depends(get_verifying_user),
                   db: Session = Depends(get_db)):
    if not user.email_verified_at:               # also limits SMS-cost abuse
        raise HTTPException(409, "Verify your email before verifying your phone")
    if user.phone_verified_at:
        raise HTTPException(409, "Phone is already verified")
    if not user.phone_e164:
        raise HTTPException(400, "No phone number on this account")
    cd = f"cd:phone:{user.id}"
    if (limiter.hit(f"resend:phone:{user.id}", 3600) > 5
            or limiter.hit(f"sms:ip:{_ip(request)}", 3600) > 10):
        raise _too_many(limiter.ttl(f"resend:phone:{user.id}"))
    if not limiter.acquire(cd, settings.OTP_RESEND_COOLDOWN_SECONDS):
        raise _too_many(limiter.ttl(cd))
    try:
        code = vs.issue_otp(db, user, vs.PHONE_OTP, user.phone_e164)
        delivery.send_sms_otp(user.phone_e164, code)
        db.commit()
    except delivery.DeliveryError:
        db.rollback()
        limiter.release(cd)
        raise HTTPException(503, "Could not send the SMS. Please try again later")
    return MessageResponse(message="Verification code sent by SMS")


@router.post("/verify-phone-otp", response_model=VerifyResult)
def verify_phone_otp(payload: OtpRequest, request: Request,
                     user: User = Depends(get_verifying_user), db: Session = Depends(get_db)):
    if limiter.hit(f"verify:ip:{_ip(request)}", 600) > 30:
        raise _too_many()
    if not user.email_verified_at:
        raise HTTPException(409, "Verify your email first")
    if user.phone_verified_at:
        raise HTTPException(409, "Phone is already verified")
    result = vs.verify_otp(db, user.id, vs.PHONE_OTP, payload.code)
    if result is not vs.OtpResult.ok:
        msg = {vs.OtpResult.invalid: "Incorrect code",
               vs.OtpResult.expired: "Code expired or not found. Request a new one",
               vs.OtpResult.locked: "Too many wrong attempts. Request a new code"}[result]
        raise HTTPException(400, msg)
    user = vs.mark_verified(db, user.id, "phone")
    db.commit()
    suffix = {"active": ". Account activated",
              "awaiting_approval": ". Waiting for administrator approval"}.get(user.status, "")
    return VerifyResult(verified=True, next_step=_next_step(user),
                        message="Phone verified" + suffix)


# ---------- password reset ----------
def _send_reset_email(name: str, to: str, token: str) -> None:
    try:
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        subject, text, body = delivery.reset_email(name, link)
        delivery.send_email(to, subject, text, body)
    except delivery.DeliveryError:
        log.error("Password-reset email could not be delivered")


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, request: Request,
                    background: BackgroundTasks, db: Session = Depends(get_db)):
    generic = MessageResponse(message="If an account exists for that email, a reset link has been sent.")
    if limiter.hit(f"forgot:ip:{_ip(request)}", 3600) > 10:
        raise _too_many()
    user = db.execute(
        select(User).where(func.lower(User.email) == payload.email.lower())
    ).scalar_one_or_none()
    if (user and user.status != UserStatus.disabled.value
            and limiter.acquire(f"cd:reset:{user.id}", settings.OTP_RESEND_COOLDOWN_SECONDS)):
        token = vs.issue_link_token(db, user, vs.PASSWORD_RESET,
                                    settings.RESET_TOKEN_TTL_MINUTES, user.email)
        db.commit()
        # Sent in the background so response time does not reveal whether the account exists.
        background.add_task(_send_reset_email, user.full_name or user.username, user.email, token)
    return generic


@router.post("/validate-reset-token", response_model=TokenValidity)
def validate_reset_token(payload: TokenRequest, request: Request, db: Session = Depends(get_db)):
    if limiter.hit(f"verify:ip:{_ip(request)}", 600) > 30:
        raise _too_many()
    return TokenValidity(valid=vs.peek_link(db, vs.PASSWORD_RESET, payload.token) is not None)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    if limiter.hit(f"verify:ip:{_ip(request)}", 600) > 30:
        raise _too_many()
    ch = vs.consume_link(db, vs.PASSWORD_RESET, payload.token)
    if ch is None:
        raise HTTPException(400, "This link is invalid, expired or already used")
    user = vs.lock_user(db, ch.user_id)
    problems = password_problems(payload.new_password, username=user.username, email=user.email)
    if problems:
        db.rollback()                              # un-consumes the token so the user can retry
        raise HTTPException(422, detail="; ".join(problems))
    user.hashed_password = get_password_hash(payload.new_password)
    user.token_version += 1                        # every old session / token dies now
    vs.invalidate_active(db, user.id, vs.PASSWORD_RESET)
    db.add(AuditLog(user=user.username, action="password_reset", target=None))
    db.commit()
    limiter.reset(f"login:fail:acct:{user.username.lower()}")
    limiter.reset(f"login:fail:acct:{user.email.lower()}")
    if user.phone_e164:
       limiter.reset(f"login:fail:acct:{user.phone_e164}")
    return MessageResponse(message="Password updated. You can now log in.")

# ---------- admin approval ----------
def _locked_user_or_404(db: Session, user_id: int) -> User:
    user = db.execute(
        select(User).where(User.id == user_id).with_for_update()
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "User not found")
    return user


@router.get("/admin/pending-users", response_model=List[PendingUserOut])
def pending_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.execute(
        select(User).where(User.status == UserStatus.awaiting_approval.value)
        .order_by(User.created_at)
    ).scalars().all()


@router.post("/admin/users/{user_id}/approve", response_model=MessageResponse)
def approve_user(user_id: int, admin: User = Depends(require_admin),
                 db: Session = Depends(get_db)):
    user = _locked_user_or_404(db, user_id)
    if user.status != UserStatus.awaiting_approval.value:
        raise HTTPException(409, "Only users awaiting approval can be approved")
    needs_phone = bool(user.phone_e164)           # OAuth sign-ups have no phone on purpose
    if not user.email_verified_at or (needs_phone and not user.phone_verified_at):
        raise HTTPException(409, "User has not completed verification")
    user.status = UserStatus.active.value
    db.add(AuditLog(user=admin.username, action="user_approved", target=user.username))
    db.commit()
    return MessageResponse(message=f"{user.username} approved")

@router.post("/admin/users/{user_id}/reject", response_model=MessageResponse)
def reject_user(user_id: int, admin: User = Depends(require_admin),
                db: Session = Depends(get_db)):
    user = _locked_user_or_404(db, user_id)
    if user.status not in (UserStatus.awaiting_approval.value, UserStatus.pending.value):
        raise HTTPException(409, "Only pending users can be rejected")
    user.status = UserStatus.disabled.value
    user.token_version += 1
    db.add(AuditLog(user=admin.username, action="user_rejected", target=user.username))
    db.commit()
    return MessageResponse(message=f"{user.username} rejected")

# ---------- register page: prove the email BEFORE the account exists ----------
def _otp_error(result: vs.OtpResult) -> HTTPException:
    msg = {vs.OtpResult.invalid: "Incorrect code",
           vs.OtpResult.expired: "Code expired or not found. Request a new one",
           vs.OtpResult.locked: "Too many wrong attempts. Request a new code"}[result]
    return HTTPException(400, msg)


@router.post("/register/send-email-code", response_model=MessageResponse)
def send_signup_email_code(payload: EmailRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email
    if limiter.hit(f"signup:code:ip:{_ip(request)}", 3600) > 10:
        raise _too_many(limiter.ttl(f"signup:code:ip:{_ip(request)}"))
    if limiter.hit(f"signup:code:email:{email}", 3600) > 5:
        raise _too_many(limiter.ttl(f"signup:code:email:{email}"))

    if db.execute(select(User.id).where(func.lower(User.email) == email)).first():
        raise HTTPException(409, "An account with this email already exists. Sign in instead")

    cd = f"cd:signup:{email}"
    if not limiter.acquire(cd, settings.OTP_RESEND_COOLDOWN_SECONDS):
        raise _too_many(limiter.ttl(cd))
    try:
        code = vs.issue_signup_code(db, email)
        subject, text, body = delivery.signup_code_email(code)
        delivery.send_email(email, subject, text, body)
        db.commit()
    except delivery.DeliveryError:
        db.rollback()
        limiter.release(cd)
        raise HTTPException(503, "Could not send the email. Please try again later")
    return MessageResponse(message="Verification code sent")


@router.post("/register/verify-email-code", response_model=EmailProofResponse)
def verify_signup_email_code(payload: SignupCodeVerify, request: Request,
                             db: Session = Depends(get_db)):
    if limiter.hit(f"verify:ip:{_ip(request)}", 600) > 30:
        raise _too_many()
    result = vs.verify_signup_code(db, payload.email, payload.code)
    if result is not vs.OtpResult.ok:
        raise _otp_error(result)
    proof = vs.create_email_proof(payload.email)
    db.commit()
    return EmailProofResponse(email_proof=proof, expires_in=vs.EMAIL_PROOF_MINUTES * 60)


# ---------- sign in with an SMS code ----------
def _sms_login_user(db: Session, phone: str) -> Optional[User]:
    """Only active, non-admin accounts with a verified phone may sign in by SMS."""
    user = db.execute(select(User).where(User.phone_e164 == phone)).scalar_one_or_none()
    if (user is None or user.status != UserStatus.active.value
            or not user.phone_verified_at or user.role == UserRole.admin):
        return None
    return user


def _send_login_sms(phone: str, code: str) -> None:
    try:
        delivery.send_sms_otp(phone, code)
    except delivery.DeliveryError:
        log.error("Sign-in SMS could not be delivered")   # never log the code


@router.get("/options", response_model=AuthOptions)
def auth_options():
    """Which sign-in methods the UI may show. Contains no secrets."""
    return AuthOptions(
        google=oa.is_configured("google"),
        github=oa.is_configured("github"),
        phone_login=settings.PHONE_LOGIN_ENABLED and delivery.sms_configured(),
    )


@router.post("/phone-login/send", response_model=MessageResponse)
def phone_login_send(payload: PhoneLoginSend, request: Request,
                     background: BackgroundTasks, db: Session = Depends(get_db)):
    if not (settings.PHONE_LOGIN_ENABLED and delivery.sms_configured()):
        raise HTTPException(503, "Sign in with SMS is not available")
    phone = payload.phone
    if limiter.hit(f"plogin:ip:{_ip(request)}", 3600) > 10:
        raise _too_many(limiter.ttl(f"plogin:ip:{_ip(request)}"))
    if limiter.hit(f"plogin:phone:{phone}", 3600) > 5:
        raise _too_many(limiter.ttl(f"plogin:phone:{phone}"))

    user = _sms_login_user(db, phone)
    if user and limiter.acquire(f"cd:plogin:{phone}", settings.OTP_RESEND_COOLDOWN_SECONDS):
        code = vs.issue_otp(db, user, vs.PHONE_LOGIN, phone)
        db.commit()
        background.add_task(_send_login_sms, phone, code)   # after the response: no timing leak
    return MessageResponse(message="If this number can sign in with SMS, a code was sent.")


@router.post("/phone-login/verify", response_model=Token)
def phone_login_verify(payload: PhoneLoginVerify, request: Request, db: Session = Depends(get_db)):
    phone, ip = payload.phone, _ip(request)
    acct_key, ip_key = f"plogin:fail:{phone}", f"plogin:fail:ip:{ip}"
    if limiter.count(acct_key) >= 10 or limiter.count(ip_key) >= 30:
        raise _too_many(max(limiter.ttl(acct_key), limiter.ttl(ip_key)))

    def fail() -> HTTPException:
        limiter.hit(acct_key, 900)
        limiter.hit(ip_key, 900)
        return HTTPException(400, "Incorrect or expired code")   # same answer for every failure

    user = _sms_login_user(db, phone)
    if user is None:
        raise fail()
    if vs.verify_otp(db, user.id, vs.PHONE_LOGIN, payload.code) is not vs.OtpResult.ok:
        raise fail()

    token = create_access_token(
        data={"sub": user.username, "role": user.role.value, "tv": user.token_version},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    db.add(AuditLog(user=user.username, action="login_sms", target=None))
    db.commit()
    limiter.reset(acct_key)
    return Token(access_token=token, username=user.username, role=user.role)
import hmac
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.core import limiter
from app.core.security import create_user_session, get_current_user, get_password_hash
from app.db.postgres import get_db
from app.ml.models.audit_log import AuditLog
from app.ml.models.user import User, UserRole, UserStatus
from app.models.oauth_identity import OAuthIdentity
from app.schemas.account import TokenRequest
from app.schemas.auth import Token
from app.services import oauth_service as oa
from app.services import verification_service as vs

log = logging.getLogger("siem.oauth")
router = APIRouter(prefix="/auth/oauth", tags=["OAuth"])

NONCE_COOKIE = "oauth_nonce"
COOKIE_PATH = "/api/v1/auth/oauth"
EXCHANGE = "oauth_exchange"
LINK_TICKET = "oauth_link_ticket"
LOGIN_PAGE = "/oauth/callback"
LINK_PAGE = "/account/connections"


class LinkTicket(BaseModel):
    ticket: str


class IdentityOut(BaseModel):
    provider: str
    email: Optional[str] = None


# ---------- helpers ----------
def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _frontend(path: str, **params: str) -> RedirectResponse:
    url = f"{settings.FRONTEND_URL.rstrip('/')}{path}"
    if params:
        url += "?" + urlencode(params)
    resp = RedirectResponse(url, status_code=302)
    resp.delete_cookie(NONCE_COOKIE, path=COOKIE_PATH)
    return resp


def _make_state(provider: str, nonce: str, mode: str, uid: Optional[int]) -> str:
    claims = {
        "scope": "oauth_state", "p": provider, "n": nonce, "m": mode,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=settings.OAUTH_STATE_TTL_SECONDS),
    }
    if uid is not None:
        claims["uid"] = uid
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _read_state(provider: str, state: Optional[str], cookie_nonce: Optional[str]) -> Optional[dict]:
    """Valid only if signed by us, not expired, for this provider, AND started in this browser."""
    if not state or not cookie_nonce:
        return None
    try:
        c = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    if c.get("scope") != "oauth_state" or c.get("p") != provider:
        return None
    if not hmac.compare_digest(str(c.get("n", "")), cookie_nonce):
        return None
    if c.get("m") not in ("login", "link"):
        return None
    if c["m"] == "link" and not isinstance(c.get("uid"), int):
        return None
    return c


def _unique_username(db: Session, email: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_.-]", "", email.split("@")[0])[:24]
    if len(base) < 3:
        base = (base + "user")[:24]
    candidate = base
    while db.execute(select(User.id).where(User.username == candidate)).first():
        candidate = f"{base}{secrets.randbelow(10**4):04d}"
    return candidate


def _find_identity(db: Session, provider: str, subject: str) -> Optional[OAuthIdentity]:
    return db.execute(
        select(OAuthIdentity).where(OAuthIdentity.provider == provider,
                                    OAuthIdentity.subject == subject)
    ).scalar_one_or_none()


# ---------- public info ----------
@router.get("/providers")
def providers():
    """Which sign-in buttons the UI may show. Contains no secrets."""
    return {p: oa.is_configured(p) for p in oa.PROVIDERS}


# ---------- start ----------
@router.get("/{provider}/start")
def start(provider: str, request: Request,
          link_ticket: Optional[str] = Query(default=None, max_length=200),
          db: Session = Depends(get_db)):
    if provider not in oa.PROVIDERS:
        raise HTTPException(404, "Unknown provider")
    mode, uid = "login", None
    dest = LOGIN_PAGE

    if link_ticket:
        mode, dest = "link", LINK_PAGE
        ch = vs.consume_link(db, LINK_TICKET, link_ticket)   # single use
        ok = bool(ch and ch.sent_to == provider)
        uid = ch.user_id if ch else None
        db.commit()
        if not ok:
            return _frontend(LINK_PAGE, error="link_expired")

    if limiter.hit(f"oauth:start:{_ip(request)}", 600) > 30:
        return _frontend(dest, error="rate_limited")
    if not oa.is_configured(provider):
        return _frontend(dest, error="provider_unavailable")

    nonce = secrets.token_urlsafe(24)
    resp = RedirectResponse(oa.authorize_url(provider, _make_state(provider, nonce, mode, uid)),
                            status_code=302)
    resp.set_cookie(NONCE_COOKIE, nonce, max_age=settings.OAUTH_STATE_TTL_SECONDS,
                    httponly=True, secure=settings.is_production, samesite="lax", path=COOKIE_PATH)
    return resp


# ---------- callback ----------
@router.get("/{provider}/callback")
def callback(provider: str, request: Request, code: Optional[str] = None,
             state: Optional[str] = None, error: Optional[str] = None,
             db: Session = Depends(get_db)):
    if provider not in oa.PROVIDERS:
        raise HTTPException(404, "Unknown provider")

    claims = _read_state(provider, state, request.cookies.get(NONCE_COOKIE))
    if claims is None:
        return _frontend(LOGIN_PAGE, error="invalid_state")
    link_mode = claims["m"] == "link"
    dest = LINK_PAGE if link_mode else LOGIN_PAGE

    if error or not code:
        return _frontend(dest, error="cancelled")
    if limiter.hit(f"oauth:cb:{_ip(request)}", 600) > 30:
        return _frontend(dest, error="rate_limited")

    try:
        profile = oa.fetch_profile(provider, code, need_email=not link_mode)
    except oa.OAuthError as exc:
        return _frontend(dest, error=exc.code)

    if link_mode:
        return _handle_link(db, provider, profile, claims["uid"])
    return _handle_login(db, provider, profile)


def _handle_link(db: Session, provider: str, profile: oa.Profile, uid: int) -> RedirectResponse:
    user = db.get(User, uid)
    if user is None or user.status != UserStatus.active.value:
        return _frontend(LINK_PAGE, error="account_not_active")

    existing = _find_identity(db, provider, profile.subject)
    if existing is not None:
        if existing.user_id == user.id:
            return _frontend(LINK_PAGE, linked=provider)
        return _frontend(LINK_PAGE, error="already_linked_elsewhere")

    mine = db.execute(select(OAuthIdentity).where(
        OAuthIdentity.user_id == user.id, OAuthIdentity.provider == provider)).scalar_one_or_none()
    if mine is not None:
        return _frontend(LINK_PAGE, error="provider_already_connected")

    db.add(OAuthIdentity(user_id=user.id, provider=provider, subject=profile.subject,
                         email=profile.email))
    db.add(AuditLog(user=user.username, action="oauth_linked", target=provider))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return _frontend(LINK_PAGE, error="try_again")
    return _frontend(LINK_PAGE, linked=provider)


def _handle_login(db: Session, provider: str, profile: oa.Profile) -> RedirectResponse:
    ident = _find_identity(db, provider, profile.subject)
    user = db.get(User, ident.user_id) if ident else None

    if user is None:
        # First time this provider account is seen: it needs a verified email.
        if not (profile.email and profile.email_verified):
            return _frontend(LOGIN_PAGE, error="no_verified_email")

        local = db.execute(
            select(User).where(func.lower(User.email) == profile.email)
        ).scalar_one_or_none()

        if local is not None:
            # Auto-link only accounts whose email AND phone were proven by the new flow.
            # Older accounts could have been created by anyone with any email (pre-hijack risk).
            if not (local.email_verified_at and local.phone_verified_at):
                return _frontend(LOGIN_PAGE, error="account_exists")
            user, action = local, "oauth_linked"
        else:
            user = User(
                username=_unique_username(db, profile.email),
                full_name=profile.name[:120] if profile.name else None,
                email=profile.email,
                hashed_password=get_password_hash(secrets.token_urlsafe(48)),  # unusable random password
                role=UserRole.analyst,                                          # OAuth never creates admins
                status=(UserStatus.awaiting_approval.value if settings.REQUIRE_ADMIN_APPROVAL
                        else UserStatus.active.value),
                email_verified_at=vs.utcnow(),
            )
            db.add(user)
            action = "oauth_signup"
        try:
            db.flush()
            db.add(OAuthIdentity(user_id=user.id, provider=provider, subject=profile.subject,
                                 email=profile.email))
            db.add(AuditLog(user=user.username, action=action, target=provider))
            db.commit()
        except IntegrityError:        # lost a race with a parallel sign-in
            db.rollback()
            return _frontend(LOGIN_PAGE, error="try_again")

    if user.status == UserStatus.disabled.value:
        return _frontend(LOGIN_PAGE, error="account_disabled")
    if user.status != UserStatus.active.value:
        return _frontend(LOGIN_PAGE, status="awaiting_approval"
                         if user.status == UserStatus.awaiting_approval.value else "pending")

    code = vs.issue_link_token(db, user, EXCHANGE, 1, provider)      # valid for 1 minute
    db.add(AuditLog(user=user.username, action="oauth_login", target=provider))
    db.commit()
    return _frontend(LOGIN_PAGE, code=code)


# ---------- exchange the one-time code for the normal login token ----------
@router.post("/exchange", response_model=Token)
def exchange(payload: TokenRequest, request: Request, db: Session = Depends(get_db)):
    if limiter.hit(f"oauth:ex:{_ip(request)}", 600) > 30:
        raise HTTPException(429, "Too many requests. Please try again later.",
                            headers={"Retry-After": "60"})
    ch = vs.consume_link(db, EXCHANGE, payload.token)
    if ch is None:
        raise HTTPException(400, "This sign-in expired. Please try again")
    user = db.get(User, ch.user_id)
    if user is None or user.status != UserStatus.active.value:
        db.rollback()
        raise HTTPException(403, "This account cannot sign in")
    token = create_user_session(db, user, request)
    db.commit()
    return Token(access_token=token, username=user.username, role=user.role)


# ---------- connect a provider to the signed-in account ----------
@router.post("/{provider}/link-ticket", response_model=LinkTicket)
def link_ticket(provider: str, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    if provider not in oa.PROVIDERS:
        raise HTTPException(404, "Unknown provider")
    if not oa.is_configured(provider):
        raise HTTPException(503, "This sign-in provider is not configured")
    ticket = vs.issue_link_token(db, user, LINK_TICKET, 1, provider)
    db.commit()
    return LinkTicket(ticket=ticket)


@router.get("/identities", response_model=List[IdentityOut])
def identities(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(OAuthIdentity).where(OAuthIdentity.user_id == user.id)).scalars().all()
    return [IdentityOut(provider=r.provider, email=r.email) for r in rows]

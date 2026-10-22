
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.postgres import get_db
from app.ml.models.user import User, UserStatus
from app.models.user_session import UserSession


# Argon2id for new hashes; existing bcrypt hashes remain supported.
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated=["bcrypt"],
    argon2__type="ID",
    argon2__memory_cost=65536,
    argon2__time_cost=2,
    argon2__parallelism=2,
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=True,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def verify_and_update(
    plain: str, hashed: str
) -> Tuple[bool, Optional[str]]:
    """Return (is_valid, new_hash_if_upgrade_needed)."""
    try:
        return pwd_context.verify_and_update(plain, hashed)
    except (ValueError, TypeError):
        return False, None


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# Dummy hash used to reduce timing-based username discovery.
DUMMY_HASH = pwd_context.hash("not-a-real-password-for-timing")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create an access token with a stable session-start timestamp."""
    to_encode = data.copy()
    now = _now()

    to_encode.setdefault("session_started", int(now.timestamp()))
    to_encode["iat"] = int(now.timestamp())
    to_encode["exp"] = now + (
        expires_delta or timedelta(minutes=15)
    )

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_user_session(db: Session, user: User, request: Request) -> str:
    """Persist a login session and return its signed access token."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    session_id = secrets.token_urlsafe(32)
    db.add(UserSession(
        id=session_id,
        user_id=user.id,
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        ip_address=request.client.host if request.client else None,
        created_at=now.replace(tzinfo=None),
        expires_at=expires_at.replace(tzinfo=None),
    ))
    return create_access_token(
        data={"sub": user.username, "role": user.role.value,
              "tv": user.token_version, "sid": session_id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_verification_token(user: User) -> str:
    """Create a short-lived token for verification endpoints only."""
    now = _now()

    return jwt.encode(
        {
            "sub": str(user.id),
            "scope": "verification",
            "tv": user.token_version,
            "iat": int(now.timestamp()),
            "exp": now + timedelta(minutes=30),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except JWTError:
        raise _unauthorized()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = _decode(token)
    username = payload.get("sub")

    # Verification tokens cannot access normal API endpoints.
    if username is None or payload.get("scope") is not None:
        raise _unauthorized()

    user = db.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()

    session_id = payload.get("sid")
    if session_id is not None:
        if user is None:
            raise _unauthorized()
        session = db.get(UserSession, session_id)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if session is None or session.user_id != user.id:
            raise _unauthorized()
        if session.revoked_at is not None or session.expires_at <= now:
            raise _unauthorized()

    if (
        user is None
        or user.status != UserStatus.active.value
        or payload.get("tv", 0) != user.token_version
    ):
        raise _unauthorized()

    return user


def get_session_started(
    token: str = Depends(oauth2_scheme),
) -> datetime:
    """
    Return the session start from the signed access token.

    Older tokens fall back to their issued-at (iat) timestamp.
    Tokens without a valid session timestamp are rejected.
    """
    payload = _decode(token)

    # Do not accept verification-only tokens as API sessions.
    if payload.get("scope") is not None:
        raise _unauthorized()

    timestamp = payload.get(
        "session_started",
        payload.get("iat"),
    )

    try:
        if isinstance(timestamp, (int, float)):
            return datetime.fromtimestamp(
                timestamp,
                tz=timezone.utc,
            )

        if isinstance(timestamp, str):
            try:
                return datetime.fromtimestamp(
                    float(timestamp),
                    tz=timezone.utc,
                )
            except ValueError:
                parsed = datetime.fromisoformat(
                    timestamp.replace("Z", "+00:00")
                )
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(timezone.utc)

    except (OverflowError, OSError, ValueError, TypeError):
        raise _unauthorized()

    raise _unauthorized()


def get_access_session_id(token: str = Depends(oauth2_scheme)) -> Optional[str]:
    session_id = _decode(token).get("sid")
    return session_id if isinstance(session_id, str) else None


def get_verifying_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = _decode(token)

    if payload.get("scope") != "verification":
        raise _unauthorized()

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise _unauthorized()

    user = db.get(User, user_id)

    if (
        user is None
        or user.status == UserStatus.disabled.value
        or payload.get("tv", 0) != user.token_version
    ):
        raise _unauthorized()

    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user

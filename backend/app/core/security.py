from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.postgres import get_db
from app.ml.models.user import User, UserStatus

# New hashes use Argon2id. Old bcrypt hashes still verify and are upgraded at next login.
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated=["bcrypt"],
    argon2__type="ID",
    argon2__memory_cost=65536,   # 64 MiB
    argon2__time_cost=2,
    argon2__parallelism=2,
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False


def verify_and_update(plain: str, hashed: str) -> Tuple[bool, Optional[str]]:
    """Return (is_valid, new_hash_if_upgrade_needed)."""
    try:
        return pwd_context.verify_and_update(plain, hashed)
    except ValueError:
        return False, None


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# Used to spend equal time when the user does not exist (stops timing-based user discovery).
DUMMY_HASH = pwd_context.hash("not-a-real-password-for-timing")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    to_encode["exp"] = _now() + (expires_delta or timedelta(minutes=15))
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_verification_token(user: User) -> str:
    """Short-lived token that only allows the verification endpoints, not the SIEM API."""
    return jwt.encode(
        {"sub": str(user.id), "scope": "verification", "tv": user.token_version,
         "exp": _now() + timedelta(minutes=30)},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise _unauthorized()


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    payload = _decode(token)
    username = payload.get("sub")
    if username is None or payload.get("scope") is not None:  # reject verification tokens
        raise _unauthorized()
    user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if (
        user is None
        or user.status != UserStatus.active.value
        or payload.get("tv", 0) != user.token_version
    ):
        raise _unauthorized()
    return user


def get_verifying_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
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


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
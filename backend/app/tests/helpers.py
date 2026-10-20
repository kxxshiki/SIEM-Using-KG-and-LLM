
import re
from datetime import datetime, timedelta

from sqlalchemy import select, update, func

from app.core.security import get_password_hash
from app.db.postgres import SessionLocal
from app.ml.models.user import User, UserRole
from app.models.auth_challenge import AuthChallenge
from app.models.signup_email_code import SignupEmailCode

API = "/api/v1/auth"
GOOD_PW = "Str0ng!Passphrase#42"
NEW_PW = "Brand#New9Passphrase!"
PHONE = "+14155552671"

# The outbox fixture sets this so helpers can read emailed verification codes.
ACTIVE_OUTBOX = None


class Outbox:
    """Captures mocked email/SMS so tests can read codes and links."""

    def __init__(self):
        self.emails, self.sms = [], []
        self.fail_email = False
        self.fail_sms = False

    def _last(self, to):
        for m in reversed(self.emails):
            if m["to"] == to:
                return m["text"]
        raise AssertionError(f"no email was sent to {to}")

    def emails_to(self, to):
        return [m for m in self.emails if m["to"] == to]

    def email_code(self, to):
        return re.search(
            r"Enter this code: (\d{6})", self._last(to)
        ).group(1)

    def email_token(self, to):
        return re.search(
            r"verify-email\?token=([\w-]+)", self._last(to)
        ).group(1)

    def reset_token(self, to):
        return re.search(
            r"reset-password\?token=([\w-]+)", self._last(to)
        ).group(1)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def reg_payload(**o):
    d = dict(
        username="alice",
        full_name="Alice Test",
        email="alice@example.com",
        phone=PHONE,
        password=GOOD_PW,
        confirm_password=GOOD_PW,
    )
    d.update(o)
    return d


def count_users():
    with SessionLocal() as db:
        return db.execute(
            select(func.count()).select_from(User)
        ).scalar_one()


def signup_code_rows(email):
    with SessionLocal() as db:
        return list(
            db.execute(
                select(SignupEmailCode).where(
                    SignupEmailCode.email == email
                )
            ).scalars()
        )


def expire_signup_codes(email):
    with SessionLocal() as db:
        db.execute(
            update(SignupEmailCode)
            .where(SignupEmailCode.email == email)
            .values(
                expires_at=datetime.utcnow() - timedelta(minutes=1)
            )
        )
        db.commit()


def register_raw(client, **o):
    """Submit registration directly, without automatically verifying email."""
    return client.post(
        f"{API}/register",
        json=reg_payload(**o),
    )


def get_email_proof(client, email):
    """Send and verify the signup email code. Returns (proof, last_response)."""
    if ACTIVE_OUTBOX is None:
        raise RuntimeError(
            "ACTIVE_OUTBOX is not set. Ensure the outbox fixture assigns it."
        )

    r = client.post(
        f"{API}/register/send-email-code",
        json={"email": email},
    )
    if r.status_code != 200:
        return None, r

    code = ACTIVE_OUTBOX.email_code(email.lower())
    r = client.post(
        f"{API}/register/verify-email-code",
        json={"email": email, "code": code},
    )
    if r.status_code != 200:
        return None, r

    return r.json()["email_proof"], r


def register(client, **o):
    """Prove the email first, then submit the account registration."""
    if "email_proof" not in o:
        email = reg_payload(**o)["email"]
        proof, resp = get_email_proof(client, email)
        if proof is None:
            return resp
        o["email_proof"] = proof

    return register_raw(client, **o)


def login(client, ident, password):
    return client.post(
        f"{API}/login",
        data={"username": ident, "password": password},
    )


def wrong_code(code):
    return "000000" if code != "000000" else "111111"


def get_user(username):
    with SessionLocal() as db:
        return db.execute(
            select(User).where(User.username == username)
        ).scalar_one()


def set_user(username, **values):
    with SessionLocal() as db:
        db.execute(
            update(User).where(User.username == username).values(**values)
        )
        db.commit()


def challenges(user_id):
    with SessionLocal() as db:
        return list(
            db.execute(
                select(AuthChallenge).where(
                    AuthChallenge.user_id == user_id
                )
            ).scalars()
        )


def expire_challenges(user_id, purpose):
    with SessionLocal() as db:
        db.execute(
            update(AuthChallenge)
            .where(
                AuthChallenge.user_id == user_id,
                AuthChallenge.purpose == purpose,
            )
            .values(
                expires_at=datetime.utcnow() - timedelta(minutes=1)
            )
        )
        db.commit()


def make_user(
    username="bob",
    password=GOOD_PW,
    role=UserRole.analyst,
    status="active",
    email=None,
    phone=None,
    hashed=None,
):
    verified = (
        datetime.utcnow()
        if status in ("active", "awaiting_approval")
        else None
    )

    with SessionLocal() as db:
        u = User(
            username=username,
            email=email or f"{username}@example.com",
            phone_e164=phone,
            hashed_password=hashed or get_password_hash(password),
            role=role,
            status=status,
            email_verified_at=verified,
            phone_verified_at=(
                verified if phone or status != "active" else None
            ),
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u


def complete_signup(client, outbox, **o):
    """Register, verify phone by OTP, and return the verification token."""
    r = register(client, **o)
    assert r.status_code == 201, r.text

    tok = r.json()["verification_token"]

    r = client.post(
        f"{API}/send-phone-otp",
        headers=bearer(tok),
    )
    assert r.status_code == 200, r.text

    r = client.post(
        f"{API}/verify-phone-otp",
        json={"code": outbox.sms[-1]["code"]},
        headers=bearer(tok),
    )
    assert r.status_code == 200, r.text

    return tok

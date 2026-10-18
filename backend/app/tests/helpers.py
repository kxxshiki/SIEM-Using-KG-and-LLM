import re
from datetime import datetime, timedelta

from sqlalchemy import select, update

from app.core.security import get_password_hash
from app.db.postgres import SessionLocal
from app.ml.models.user import User, UserRole
from app.models.auth_challenge import AuthChallenge

API = "/api/v1/auth"
GOOD_PW = "Str0ng!Passphrase#42"
NEW_PW = "Brand#New9Passphrase!"
PHONE = "+14155552671"


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
        return re.search(r"Enter this code: (\d{6})", self._last(to)).group(1)

    def email_token(self, to):
        return re.search(r"verify-email\?token=([\w-]+)", self._last(to)).group(1)

    def reset_token(self, to):
        return re.search(r"reset-password\?token=([\w-]+)", self._last(to)).group(1)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def reg_payload(**o):
    d = dict(username="alice", full_name="Alice Test", email="alice@example.com",
             phone=PHONE, password=GOOD_PW, confirm_password=GOOD_PW)
    d.update(o)
    return d


def register(client, **o):
    return client.post(f"{API}/register", json=reg_payload(**o))


def login(client, ident, password):
    return client.post(f"{API}/login", data={"username": ident, "password": password})


def wrong_code(code):
    return "000000" if code != "000000" else "111111"


def get_user(username):
    with SessionLocal() as db:
        return db.execute(select(User).where(User.username == username)).scalar_one()


def set_user(username, **values):
    with SessionLocal() as db:
        db.execute(update(User).where(User.username == username).values(**values))
        db.commit()


def challenges(user_id):
    with SessionLocal() as db:
        return list(db.execute(
            select(AuthChallenge).where(AuthChallenge.user_id == user_id)).scalars())


def expire_challenges(user_id, purpose):
    with SessionLocal() as db:
        db.execute(update(AuthChallenge)
                   .where(AuthChallenge.user_id == user_id, AuthChallenge.purpose == purpose)
                   .values(expires_at=datetime.utcnow() - timedelta(minutes=1)))
        db.commit()


def make_user(username="bob", password=GOOD_PW, role=UserRole.analyst, status="active",
              email=None, phone=None, hashed=None):
    verified = datetime.utcnow() if status in ("active", "awaiting_approval") else None
    with SessionLocal() as db:
        u = User(username=username, email=email or f"{username}@example.com",
                 phone_e164=phone, hashed_password=hashed or get_password_hash(password),
                 role=role, status=status, email_verified_at=verified,
                 phone_verified_at=verified if phone or status != "active" else None)
        db.add(u)
        db.commit()
        db.refresh(u)
        return u


def complete_signup(client, outbox, **o):
    """Register, verify email by OTP, verify phone by OTP. Returns the verification token."""
    r = register(client, **o)
    assert r.status_code == 201, r.text
    tok = r.json()["verification_token"]
    email = reg_payload(**o)["email"]
    r = client.post(f"{API}/verify-email-otp", json={"code": outbox.email_code(email)},
                    headers=bearer(tok))
    assert r.status_code == 200, r.text
    assert client.post(f"{API}/send-phone-otp", headers=bearer(tok)).status_code == 200
    r = client.post(f"{API}/verify-phone-otp", json={"code": outbox.sms[-1]["code"]},
                    headers=bearer(tok))
    assert r.status_code == 200, r.text
    return tok

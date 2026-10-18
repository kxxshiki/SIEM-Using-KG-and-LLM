import re
from datetime import datetime, timedelta

import pytest
from jose import jwt
from passlib.context import CryptContext

from app.config import settings
from app.core.security import create_access_token
from app.main import app
from app.tests.helpers import PHONE
from app.tests.helpers import (API, GOOD_PW, bearer, get_user, login, make_user, register, set_user)

ME = f"{API}/me"


def _token(client, user="bob", pw=GOOD_PW):
    r = login(client, user, pw)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_valid_login_returns_token_with_version(client):
    make_user("bob")
    r = login(client, "bob", GOOD_PW)
    assert r.status_code == 200 and r.json()["username"] == "bob"
    claims = jwt.decode(r.json()["access_token"], settings.SECRET_KEY,
                        algorithms=[settings.ALGORITHM])
    assert claims["tv"] == 0 and claims["sub"] == "bob"


def test_login_by_email(client):
    make_user("bob", email="bob@example.com")
    assert login(client, "bob@example.com", GOOD_PW).status_code == 200


def test_wrong_password_and_unknown_user_look_identical(client):
    make_user("bob")
    a, b = login(client, "bob", "Wrong#Pass12345"), login(client, "nobody", "Wrong#Pass12345")
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


def test_pending_account_cannot_login(client, outbox):
    register(client)
    r = login(client, "alice", GOOD_PW)
    assert r.status_code == 403
    d = r.json()["detail"]
    assert d["code"] == "verification_required" and d["next_step"] == "verify_email"
    assert client.get(ME, headers=bearer(d["verification_token"])).status_code == 401


def test_awaiting_and_disabled_accounts_cannot_login(client):
    make_user("bob", status="awaiting_approval")
    make_user("carl", status="disabled")
    assert login(client, "bob", GOOD_PW).json()["detail"]["code"] == "approval_required"
    assert login(client, "carl", GOOD_PW).json()["detail"]["code"] == "account_disabled"


def test_me_requires_a_valid_token(client):
    make_user("bob")
    assert client.get(ME).status_code == 401
    assert client.get(ME, headers=bearer("garbage")).status_code == 401
    assert client.get(ME, headers=bearer(_token(client))).json()["username"] == "bob"


def test_expired_wrong_secret_and_unknown_user_tokens_rejected(client):
    make_user("bob")
    expired = create_access_token({"sub": "bob", "tv": 0}, timedelta(minutes=-1))
    forged = jwt.encode({"sub": "bob", "tv": 0, "exp": datetime.utcnow() + timedelta(minutes=5)},
                        "some-other-secret", algorithm=settings.ALGORITHM)
    ghost = create_access_token({"sub": "ghost", "tv": 0}, timedelta(minutes=5))
    for t in (expired, forged, ghost):
        assert client.get(ME, headers=bearer(t)).status_code == 401


def test_token_types_are_not_interchangeable(client):
    make_user("bob")
    access = _token(client)
    assert client.get(f"{API}/verification-status", headers=bearer(access)).status_code == 401


def test_version_bump_revokes_old_tokens(client):
    make_user("bob")
    t = _token(client)
    set_user("bob", token_version=5)
    assert client.get(ME, headers=bearer(t)).status_code == 401


def test_logout_revokes_all_tokens(client):
    make_user("bob")
    t1, t2 = _token(client), _token(client)
    assert client.post(f"{API}/logout", headers=bearer(t1)).status_code == 204
    assert client.get(ME, headers=bearer(t1)).status_code == 401
    assert client.get(ME, headers=bearer(t2)).status_code == 401
    assert login(client, "bob", GOOD_PW).status_code == 200


def test_disabling_user_kills_existing_token(client):
    make_user("bob")
    t = _token(client)
    set_user("bob", status="disabled")
    assert client.get(ME, headers=bearer(t)).status_code == 401


def test_login_rate_limit_locks_even_correct_password(client):
    make_user("bob")
    for _ in range(5):
        assert login(client, "bob", "Wrong#Pass12345").status_code == 401
    r = login(client, "bob", GOOD_PW)
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_changing_username_case_does_not_bypass_limit(client):
    make_user("bob")
    for name in ("bob", "BOB", "Bob", "bOb", "boB"):
        login(client, name, "Wrong#Pass12345")
    assert login(client, "bob", GOOD_PW).status_code == 429


def test_success_resets_failure_counter(client):
    make_user("bob")
    for _ in range(4):
        login(client, "bob", "Wrong#Pass12345")
    assert login(client, "bob", GOOD_PW).status_code == 200
    for _ in range(4):
        login(client, "bob", "Wrong#Pass12345")
    assert login(client, "bob", GOOD_PW).status_code == 200


def test_legacy_bcrypt_user_logs_in_and_is_upgraded(client):
    legacy = CryptContext(schemes=["bcrypt"]).hash("admin123")   # weak, old-policy password
    make_user("old", hashed=legacy)
    assert get_user("old").hashed_password.startswith("$2")
    assert login(client, "old", "admin123").status_code == 200
    assert get_user("old").hashed_password.startswith("$argon2id$")
    assert login(client, "old", "admin123").status_code == 200


def test_every_get_route_requires_authentication(client):
    """Sweeps every GET route under /api/v1. If a route is public ON PURPOSE, add it to PUBLIC."""
    PUBLIC = set()
    open_routes = []
    for route in app.routes:
        path, methods = getattr(route, "path", ""), getattr(route, "methods", None) or set()
        if not path.startswith("/api/v1") or "GET" not in methods or path in PUBLIC:
            continue
        status = client.get(re.sub(r"\{[^}]+\}", "1", path)).status_code
        if status not in (401, 403):
            open_routes.append((path, status))
    assert not open_routes, f"routes reachable without a token: {open_routes}"
    
    from app.tests.helpers import PHONE  # noqa: E402


def test_existing_user_needs_no_verification_and_no_message_is_sent(client, outbox):
    """Legacy-style user: active, no phone, never verified anything."""
    make_user("old")
    set_user("old", email_verified_at=None, phone_verified_at=None)
    assert login(client, "old", GOOD_PW).status_code == 200
    assert outbox.emails == [] and outbox.sms == []


def test_login_by_phone_in_any_format(client):
    make_user("bob", phone=PHONE)
    for ident in ("+14155552671", "+1 415 555 2671", "+1 (415) 555-2671", "+1-415-555-2671"):
        assert login(client, ident, GOOD_PW).status_code == 200, ident


def test_login_by_phone_without_country_code_uses_default_region(client, monkeypatch):
    monkeypatch.setattr(settings, "PHONE_DEFAULT_REGION", "US")
    make_user("bob", phone=PHONE)
    assert login(client, "4155552671", GOOD_PW).status_code == 200


def test_wrong_password_and_unknown_phone_look_identical(client):
    make_user("bob", phone=PHONE)
    a = login(client, PHONE, "Wrong#Pass12345")
    b = login(client, "+14155552672", "Wrong#Pass12345")
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


def test_phone_formats_share_one_rate_limit(client):
    make_user("bob", phone=PHONE)
    for ident in ("+14155552671", "+1 415 555 2671", "+1 (415) 555-2671",
                  "+1-415-555-2671", "+14155552671"):
        login(client, ident, "Wrong#Pass12345")
    assert login(client, PHONE, GOOD_PW).status_code == 429


def test_pending_user_can_resume_verification_from_phone_login(client, outbox):
    register(client)
    r = login(client, PHONE, GOOD_PW)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "verification_required"


def test_numeric_username_still_logs_in(client):
    make_user("123456789")
    assert login(client, "123456789", GOOD_PW).status_code == 200

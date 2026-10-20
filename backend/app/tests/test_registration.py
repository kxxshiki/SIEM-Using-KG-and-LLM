from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.core import limiter
from app.main import app
from tests.helpers import (API, GOOD_PW, PHONE, count_users, expire_signup_codes,
                           get_email_proof, get_user, reg_payload, register, register_raw,
                           signup_code_rows, wrong_code)

SEND = f"{API}/register/send-email-code"
VERIFY = f"{API}/register/verify-email-code"
EMAIL = "alice@example.com"


def _send(client, email=EMAIL):
    return client.post(SEND, json={"email": email})


def _verify(client, code, email=EMAIL):
    return client.post(VERIFY, json={"email": email, "code": code})


# ---------- step 1: prove the email ----------
def test_code_is_emailed_and_stored_hashed(client, outbox):
    assert _send(client).status_code == 200
    code = outbox.email_code(EMAIL)
    rows = signup_code_rows(EMAIL)
    assert len(code) == 6 and len(rows) == 1
    assert rows[0].code_hash != code and len(rows[0].code_hash) == 64


def test_correct_code_gives_a_proof_and_cannot_be_reused(client, outbox):
    _send(client)
    code = outbox.email_code(EMAIL)
    r = _verify(client, code)
    assert r.status_code == 200 and r.json()["email_proof"]
    assert _verify(client, code).status_code == 400


def test_wrong_code_then_exhaustion(client, outbox):
    _send(client)
    code = outbox.email_code(EMAIL)
    for _ in range(5):
        assert _verify(client, wrong_code(code)).status_code == 400
    assert _verify(client, code).status_code == 400      # correct code no longer works


def test_expired_code_rejected(client, outbox):
    _send(client)
    code = outbox.email_code(EMAIL)
    expire_signup_codes(EMAIL)
    assert _verify(client, code).status_code == 400


def test_new_code_replaces_the_old_one(client, outbox):
    _send(client)
    old = outbox.email_code(EMAIL)
    limiter.reset(f"cd:signup:{EMAIL}")
    _send(client)
    new = outbox.email_code(EMAIL)
    if new != old:
        assert _verify(client, old).status_code == 400
    assert _verify(client, new).status_code == 200


def test_resend_cooldown(client, outbox):
    assert _send(client).status_code == 200
    r = _send(client)
    assert r.status_code == 429 and "Retry-After" in r.headers
    assert len(outbox.emails_to(EMAIL)) == 1


def test_hourly_limit_per_email(client, outbox):
    for _ in range(5):
        limiter.reset(f"cd:signup:{EMAIL}")
        assert _send(client).status_code == 200
    limiter.reset(f"cd:signup:{EMAIL}")
    assert _send(client).status_code == 429


def test_delivery_failure_returns_503_and_releases_cooldown(client, outbox):
    outbox.fail_email = True
    assert _send(client).status_code == 503
    outbox.fail_email = False
    assert _send(client).status_code == 200
    assert len(signup_code_rows(EMAIL)) == 1             # the failed attempt was rolled back


def test_existing_email_is_refused_case_insensitively(client, outbox):
    assert register(client).status_code == 201
    assert _send(client, "ALICE@example.com").status_code == 409


def test_invalid_email_rejected(client, outbox):
    assert _send(client, "nope").status_code == 422


# ---------- step 2: create the account ----------
def test_success_creates_pending_account_with_verified_email(client, outbox):
    r = register(client)
    assert r.status_code == 201
    assert r.json()["next_step"] == "verify_phone" and r.json()["verification_token"]
    assert GOOD_PW not in r.text
    u = get_user("alice")
    assert u.status == "pending"
    assert u.email_verified_at is not None and u.phone_verified_at is None
    assert u.phone_e164 == PHONE and u.hashed_password.startswith("$argon2id$")


def test_registration_requires_a_valid_proof(client, outbox):
    assert register_raw(client).status_code == 422                       # no proof at all
    assert register_raw(client, email_proof="x" * 40).status_code == 400  # garbage proof
    assert count_users() == 0


def test_proof_only_works_for_its_own_email(client, outbox):
    proof, _ = get_email_proof(client, EMAIL)
    r = register_raw(client, email="mallory@example.com", email_proof=proof)
    assert r.status_code == 400 and count_users() == 0


def test_role_in_payload_is_ignored(client, outbox):
    assert register(client, role="admin").status_code == 201
    assert get_user("alice").role.value == "analyst"


@pytest.mark.parametrize("override", [
    {"username": "bobby", "email": "bobby@example.com", "phone": PHONE},
    {"username": "alice", "email": "bobby@example.com", "phone": "+14155552672"},
])
def test_duplicate_phone_or_username_rejected(client, outbox, override):
    assert register(client).status_code == 201
    assert register(client, **override).status_code == 409


@pytest.mark.parametrize("override", [
    {"email": "not-an-email"},
    {"phone": "12345"},
    {"phone": "+1000"},
    {"username": "a!"},
    {"password": "short1!A", "confirm_password": "short1!A"},
    {"password": "Password1234!", "confirm_password": "Password1234!"},
    {"confirm_password": "Different#Pass99xx"},
])
def test_invalid_fields_rejected(client, outbox, override):
    assert register(client, **override).status_code == 422
    assert count_users() == 0


@pytest.mark.parametrize("missing", ["username", "email", "phone", "password",
                                     "confirm_password", "email_proof"])
def test_missing_required_field(client, outbox, missing):
    proof, _ = get_email_proof(client, EMAIL)
    payload = reg_payload(email_proof=proof)
    del payload[missing]
    assert client.post(f"{API}/register", json=payload).status_code == 422


def test_register_rate_limit_per_ip(client, outbox):
    for i in range(5):
        r = register(client, username=f"user{i}", email=f"user{i}@example.com",
                     phone=f"+1415555267{i}")
        assert r.status_code == 201, r.text
    r = register(client, username="user9", email="user9@example.com", phone="+14155552679")
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_concurrent_duplicate_registration_creates_one_account(outbox):
    proof, _ = get_email_proof(TestClient(app), EMAIL)

    def attempt(_):
        return TestClient(app).post(f"{API}/register", json=reg_payload(email_proof=proof)).status_code

    with ThreadPoolExecutor(2) as ex:
        results = sorted(ex.map(attempt, range(2)))
    assert results == [201, 409]
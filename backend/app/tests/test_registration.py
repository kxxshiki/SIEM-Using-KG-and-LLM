from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.tests.helpers import API, GOOD_PW, PHONE, get_user, reg_payload, register


def test_success_creates_pending_account(client, outbox):
    r = register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["email_sent"] is True and body["next_step"] == "verify_email"
    assert GOOD_PW not in r.text and "code" not in body
    u = get_user("alice")
    assert u.status == "pending"
    assert u.email_verified_at is None and u.phone_verified_at is None
    assert u.phone_e164 == PHONE
    assert u.hashed_password.startswith("$argon2id$") and GOOD_PW not in u.hashed_password
    assert [m["to"] for m in outbox.emails] == ["alice@example.com"]


def test_role_in_payload_is_ignored(client, outbox):
    assert register(client, role="admin").status_code == 201
    assert get_user("alice").role.value == "analyst"


@pytest.mark.parametrize("override", [
    {"username": "bobby", "email": "ALICE@Example.COM", "phone": "+14155552672"},
    {"username": "bobby", "email": "bobby@example.com", "phone": PHONE},
    {"username": "alice", "email": "bobby@example.com", "phone": "+14155552672"},
])
def test_duplicates_rejected(client, outbox, override):
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
    assert outbox.emails == []


@pytest.mark.parametrize("missing", ["username", "email", "phone", "password", "confirm_password"])
def test_missing_required_field(client, outbox, missing):
    payload = reg_payload()
    del payload[missing]
    assert client.post(f"{API}/register", json=payload).status_code == 422


def test_email_failure_still_creates_account_and_resend_works(client, outbox):
    outbox.fail_email = True
    r = register(client)
    assert r.status_code == 201 and r.json()["email_sent"] is False
    outbox.fail_email = False
    tok = r.json()["verification_token"]
    r2 = client.post(f"{API}/resend-email", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200 and len(outbox.emails) == 1


def test_register_rate_limit_per_ip(client, outbox):
    for i in range(5):
        r = register(client, username=f"user{i}", email=f"user{i}@example.com",
                     phone=f"+1415555267{i}")
        assert r.status_code == 201, r.text
    r = register(client, username="user9", email="user9@example.com", phone="+14155552679")
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_concurrent_duplicate_registration_creates_one_account(outbox):
    def attempt(_):
        return TestClient(app).post(f"{API}/register", json=reg_payload()).status_code
    with ThreadPoolExecutor(2) as ex:
        results = sorted(ex.map(attempt, range(2)))
    assert results == [201, 409]

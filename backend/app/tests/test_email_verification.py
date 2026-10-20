from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.core import limiter
from app.main import app
from app.tests.helpers import (API, bearer, challenges, expire_challenges, get_user, login,
                           register, wrong_code)
from tests.helpers import (API, GOOD_PW, PHONE, bearer, challenges, expire_challenges, get_user,
                           login, make_user, wrong_code)

EMAIL = "alice@example.com"


def _signup(client):
    """A pending account whose email is NOT verified yet (for example an older account)."""
    make_user("alice", status="pending", email=EMAIL, phone=PHONE)
    tok = login(client, "alice", GOOD_PW).json()["detail"]["verification_token"]
    assert client.post(f"{API}/resend-email", headers=bearer(tok)).status_code == 200
    return tok


def _otp(client, tok, code):
    return client.post(f"{API}/verify-email-otp", json={"code": code}, headers=bearer(tok))


def test_otp_verifies_email_but_account_stays_pending(client, outbox):
    tok = _signup(client)
    r = _otp(client, tok, outbox.email_code(EMAIL))
    assert r.status_code == 200 and r.json()["next_step"] == "verify_phone"
    u = get_user("alice")
    assert u.email_verified_at is not None and u.status == "pending"
    assert login(client, "alice", "Str0ng!Passphrase#42").status_code == 403


def test_wrong_then_right_code(client, outbox):
    tok = _signup(client)
    code = outbox.email_code(EMAIL)
    assert _otp(client, tok, wrong_code(code)).status_code == 400
    assert _otp(client, tok, code).status_code == 200


def test_attempt_limit_locks_the_code(client, outbox):
    tok = _signup(client)
    code = outbox.email_code(EMAIL)
    for _ in range(5):
        assert _otp(client, tok, wrong_code(code)).status_code == 400
    assert _otp(client, tok, code).status_code == 400      # correct code no longer works
    assert get_user("alice").email_verified_at is None


def test_expired_otp_rejected(client, outbox):
    tok = _signup(client)
    code = outbox.email_code(EMAIL)
    expire_challenges(get_user("alice").id, "email_otp")
    assert _otp(client, tok, code).status_code == 400


def test_otp_cannot_be_reused(client, outbox):
    tok = _signup(client)
    code = outbox.email_code(EMAIL)
    assert _otp(client, tok, code).status_code == 200
    assert _otp(client, tok, code).status_code == 409


def test_link_verifies_once_only(client, outbox):
    _signup(client)
    t = outbox.email_token(EMAIL)
    r = client.post(f"{API}/verify-email-link", json={"token": t})
    assert r.status_code == 200 and r.json()["next_step"] == "verify_phone"
    assert client.post(f"{API}/verify-email-link", json={"token": t}).status_code == 400


def test_invalid_and_expired_links(client, outbox):
    _signup(client)
    assert client.post(f"{API}/verify-email-link", json={"token": "x" * 30}).status_code == 400
    assert client.post(f"{API}/verify-email-link", json={"token": "short"}).status_code == 422
    t = outbox.email_token(EMAIL)
    expire_challenges(get_user("alice").id, "email_link")
    assert client.post(f"{API}/verify-email-link", json={"token": t}).status_code == 400


def test_link_and_otp_are_alternatives_and_cancel_each_other(client, outbox):
    tok = _signup(client)
    code, t = outbox.email_code(EMAIL), outbox.email_token(EMAIL)
    assert client.post(f"{API}/verify-email-link", json={"token": t}).status_code == 200
    assert _otp(client, tok, code).status_code == 409
    assert all(c.consumed_at is not None for c in challenges(get_user("alice").id))


def test_otp_then_link_rejected(client, outbox):
    tok = _signup(client)
    t = outbox.email_token(EMAIL)
    assert _otp(client, tok, outbox.email_code(EMAIL)).status_code == 200
    assert client.post(f"{API}/verify-email-link", json={"token": t}).status_code == 400


def test_secrets_are_stored_hashed_only(client, outbox):
    _signup(client)
    code, t = outbox.email_code(EMAIL), outbox.email_token(EMAIL)
    rows = challenges(get_user("alice").id)
    assert rows
    for c in rows:
        assert len(c.code_hash) == 64 and c.code_hash not in (code, t)
        assert code not in str(c.sent_to) and t not in c.code_hash


def test_resend_cooldown_then_new_code_replaces_old(client, outbox):
    tok = _signup(client)
    old = outbox.email_code(EMAIL)
    r = client.post(f"{API}/resend-email", headers=bearer(tok))
    assert r.status_code == 429 and "Retry-After" in r.headers
    limiter.reset(f"cd:email:{get_user('alice').id}")
    assert client.post(f"{API}/resend-email", headers=bearer(tok)).status_code == 200
    new = outbox.email_code(EMAIL)
    if new != old:
        assert _otp(client, tok, old).status_code == 400
    assert _otp(client, tok, new).status_code == 200


def test_resend_delivery_failure_releases_cooldown(client, outbox):
    tok = _signup(client)
    limiter.reset(f"cd:email:{get_user('alice').id}")
    outbox.fail_email = True
    assert client.post(f"{API}/resend-email", headers=bearer(tok)).status_code == 503
    outbox.fail_email = False
    assert client.post(f"{API}/resend-email", headers=bearer(tok)).status_code == 200


def test_status_endpoint_masks_contact_details(client, outbox):
    tok = _signup(client)
    body = client.get(f"{API}/verification-status", headers=bearer(tok)).json()
    assert body["email_masked"] == "a***@example.com"
    assert body["phone_masked"].endswith("2671") and "415555" not in body["phone_masked"]
    assert body["next_step"] == "verify_email"


def test_verification_endpoints_need_a_token(client, outbox):
    _signup(client)
    assert client.post(f"{API}/verify-email-otp", json={"code": "123456"}).status_code == 401
    assert client.get(f"{API}/verification-status").status_code == 401


def test_concurrent_otp_submissions_only_one_wins(client, outbox):
    tok = _signup(client)
    code = outbox.email_code(EMAIL)

    def attempt(_):
        return TestClient(app).post(f"{API}/verify-email-otp", json={"code": code},
                                    headers=bearer(tok)).status_code
    with ThreadPoolExecutor(2) as ex:
        results = list(ex.map(attempt, range(2)))
    assert results.count(200) == 1
    assert all(s in (200, 400, 409) for s in results)

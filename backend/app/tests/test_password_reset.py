from app.core import limiter
from app.tests.helpers import (API, GOOD_PW, NEW_PW, bearer, challenges, expire_challenges, get_user,
                           login, make_user)

FORGOT, RESET, VALIDATE = (f"{API}/forgot-password", f"{API}/reset-password",
                           f"{API}/validate-reset-token")
EMAIL = "bob@example.com"


def _forgot(client, email=EMAIL):
    return client.post(FORGOT, json={"email": email})


def _reset(client, token, pw=NEW_PW, confirm=None):
    return client.post(RESET, json={"token": token, "new_password": pw,
                                    "confirm_password": confirm or pw})


def test_response_is_identical_for_known_and_unknown_email(client, outbox):
    make_user("bob")
    a, b = _forgot(client), _forgot(client, "nobody@example.com")
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    assert [m["to"] for m in outbox.emails] == [EMAIL]


def test_no_email_for_disabled_account(client, outbox):
    make_user("bob", status="disabled")
    assert _forgot(client).status_code == 200 and outbox.emails == []


def test_delivery_failure_is_not_revealed(client, outbox):
    make_user("bob")
    outbox.fail_email = True
    assert _forgot(client).status_code == 200


def test_reset_changes_hash_kills_old_password_and_old_tokens(client, outbox):
    make_user("bob")
    old_token = login(client, "bob", GOOD_PW).json()["access_token"]
    old_hash = get_user("bob").hashed_password
    _forgot(client)
    assert _reset(client, outbox.reset_token(EMAIL)).status_code == 200
    assert get_user("bob").hashed_password != old_hash
    assert login(client, "bob", GOOD_PW).status_code == 401
    assert login(client, "bob", NEW_PW).status_code == 200
    assert client.get(f"{API}/me", headers=bearer(old_token)).status_code == 401
    assert get_user("bob").token_version == 1


def test_token_cannot_be_reused(client, outbox):
    make_user("bob")
    _forgot(client)
    t = outbox.reset_token(EMAIL)
    assert _reset(client, t).status_code == 200
    assert _reset(client, t, "Another#Pass88Value").status_code == 400


def test_invalid_and_expired_tokens(client, outbox):
    make_user("bob")
    assert _reset(client, "x" * 30).status_code == 400
    _forgot(client)
    t = outbox.reset_token(EMAIL)
    expire_challenges(get_user("bob").id, "password_reset")
    assert _reset(client, t).status_code == 400
    assert client.post(VALIDATE, json={"token": t}).json() == {"valid": False}


def test_weak_password_rejected_and_token_still_usable(client, outbox):
    make_user("bob")
    _forgot(client)
    t = outbox.reset_token(EMAIL)
    assert _reset(client, t, "weak").status_code == 422
    assert _reset(client, t, "Bob#Strong99xyzabc").status_code == 422   # contains username
    assert _reset(client, t, NEW_PW).status_code == 200


def test_mismatched_confirmation_rejected(client, outbox):
    make_user("bob")
    _forgot(client)
    assert _reset(client, outbox.reset_token(EMAIL), NEW_PW, "Different#Pass99xx").status_code == 422


def test_new_request_invalidates_previous_token(client, outbox):
    make_user("bob")
    _forgot(client)
    first = outbox.reset_token(EMAIL)
    limiter.reset(f"cd:reset:{get_user('bob').id}")
    _forgot(client)
    second = outbox.reset_token(EMAIL)
    assert client.post(VALIDATE, json={"token": first}).json() == {"valid": False}
    assert client.post(VALIDATE, json={"token": second}).json() == {"valid": True}


def test_cooldown_sends_only_one_email(client, outbox):
    make_user("bob")
    _forgot(client)
    _forgot(client)
    assert len(outbox.emails_to(EMAIL)) == 1


def test_token_stored_hashed(client, outbox):
    make_user("bob")
    _forgot(client)
    t = outbox.reset_token(EMAIL)
    rows = challenges(get_user("bob").id)
    assert rows and all(c.code_hash != t and len(c.code_hash) == 64 for c in rows)


def test_reset_clears_login_lockout(client, outbox):
    make_user("bob")
    for _ in range(5):
        login(client, "bob", "Wrong#Pass12345")
    assert login(client, "bob", GOOD_PW).status_code == 429
    _forgot(client)
    _reset(client, outbox.reset_token(EMAIL))
    assert login(client, "bob", NEW_PW).status_code == 200


def test_forgot_password_rate_limit(client, outbox):
    for _ in range(10):
        assert _forgot(client, "nobody@example.com").status_code == 200
    assert _forgot(client, "nobody@example.com").status_code == 429

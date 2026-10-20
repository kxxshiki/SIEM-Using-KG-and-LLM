import pytest

from app.ml.models.user import UserRole
from app.services import delivery_service as delivery
from tests.helpers import (API, PHONE, bearer, expire_challenges, get_user, make_user,
                           set_user, wrong_code)

SEND = f"{API}/phone-login/send"
VERIFY = f"{API}/phone-login/verify"
OTHER = "+14155552672"


@pytest.fixture(autouse=True)
def _sms_on(monkeypatch):
    monkeypatch.setattr(delivery, "sms_configured", lambda: True)


def _send(client, phone=PHONE):
    return client.post(SEND, json={"phone": phone})


def _verify(client, code, phone=PHONE):
    return client.post(VERIFY, json={"phone": phone, "code": code})


def test_full_sms_sign_in(client, outbox):
    make_user("bob", phone=PHONE)
    assert _send(client).status_code == 200
    assert [m["to"] for m in outbox.sms] == [PHONE]
    r = _verify(client, outbox.sms[-1]["code"])
    assert r.status_code == 200 and r.json()["username"] == "bob"
    me = client.get(f"{API}/me", headers=bearer(r.json()["access_token"]))
    assert me.json()["username"] == "bob"


def test_answer_does_not_reveal_whether_the_number_exists(client, outbox):
    make_user("bob", phone=PHONE)
    a, b = _send(client), _send(client, OTHER)
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    assert len(outbox.sms) == 1


@pytest.mark.parametrize("kw", [
    {"role": UserRole.admin},
    {"status": "pending"},
    {"status": "awaiting_approval"},
    {"status": "disabled"},
])
def test_ineligible_accounts_get_no_sms(client, outbox, kw):
    make_user("bob", phone=PHONE, **kw)
    assert _send(client).status_code == 200
    assert outbox.sms == []


def test_unverified_phone_gets_no_sms(client, outbox):
    make_user("bob", phone=PHONE)
    set_user("bob", phone_verified_at=None)
    assert _send(client).status_code == 200 and outbox.sms == []


def test_wrong_code_and_unknown_number_look_the_same(client, outbox):
    make_user("bob", phone=PHONE)
    _send(client)
    a = _verify(client, wrong_code(outbox.sms[-1]["code"]))
    b = _verify(client, "123456", OTHER)
    assert a.status_code == b.status_code == 400 and a.json() == b.json()


def test_code_cannot_be_replayed(client, outbox):
    make_user("bob", phone=PHONE)
    _send(client)
    code = outbox.sms[-1]["code"]
    assert _verify(client, code).status_code == 200
    assert _verify(client, code).status_code == 400


def test_five_wrong_guesses_lock_the_code(client, outbox):
    make_user("bob", phone=PHONE)
    _send(client)
    code = outbox.sms[-1]["code"]
    for _ in range(5):
        assert _verify(client, wrong_code(code)).status_code == 400
    assert _verify(client, code).status_code == 400


def test_expired_code_rejected(client, outbox):
    make_user("bob", phone=PHONE)
    _send(client)
    expire_challenges(get_user("bob").id, "phone_login")
    assert _verify(client, outbox.sms[-1]["code"]).status_code == 400


def test_cooldown_sends_only_one_sms(client, outbox):
    make_user("bob", phone=PHONE)
    _send(client)
    _send(client)
    assert len(outbox.sms) == 1


def test_hourly_limit_per_number(client, outbox):
    make_user("bob", phone=PHONE)
    for _ in range(5):
        assert _send(client).status_code == 200
    assert _send(client).status_code == 429


def test_sms_delivery_failure_is_not_revealed(client, outbox):
    make_user("bob", phone=PHONE)
    outbox.fail_sms = True
    assert _send(client).status_code == 200 and outbox.sms == []


def test_unavailable_when_sms_is_not_configured(client, monkeypatch):
    monkeypatch.setattr(delivery, "sms_configured", lambda: False)
    assert _send(client).status_code == 503


def test_invalid_number_rejected(client):
    assert _send(client, "12345").status_code == 422


def test_options_endpoint_reports_phone_sign_in(client, monkeypatch):
    assert client.get(f"{API}/options").json()["phone_login"] is True
    monkeypatch.setattr(delivery, "sms_configured", lambda: False)
    assert client.get(f"{API}/options").json()["phone_login"] is False
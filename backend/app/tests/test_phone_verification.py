import logging

import httpx
import pytest

from app.config import settings
from app.core import limiter
from app.services import delivery_service as delivery
from app.tests.helpers import (API, GOOD_PW, bearer, challenges, complete_signup, expire_challenges,
                           get_user, login, register, wrong_code)


def _email_verified_signup(client, outbox):
    tok = register(client).json()["verification_token"]
    client.post(f"{API}/verify-email-otp", json={"code": outbox.email_code("alice@example.com")},
                headers=bearer(tok))
    return tok


def _send(client, tok):
    return client.post(f"{API}/send-phone-otp", headers=bearer(tok))


def _verify(client, tok, code):
    return client.post(f"{API}/verify-phone-otp", json={"code": code}, headers=bearer(tok))


def test_phone_step_requires_verified_email(client, outbox):
    tok = register(client).json()["verification_token"]
    assert _send(client, tok).status_code == 409
    assert _verify(client, tok, "123456").status_code == 409
    assert outbox.sms == []


def test_full_flow_ends_in_awaiting_approval(client, outbox):
    complete_signup(client, outbox)
    u = get_user("alice")
    assert u.phone_verified_at is not None and u.status == "awaiting_approval"
    assert login(client, "alice", GOOD_PW).status_code == 403


def test_without_approval_requirement_account_activates(client, outbox, monkeypatch):
    monkeypatch.setattr(settings, "REQUIRE_ADMIN_APPROVAL", False)
    complete_signup(client, outbox)
    assert get_user("alice").status == "active"
    assert login(client, "alice", GOOD_PW).status_code == 200


def test_wrong_code_reuse_and_exhaustion(client, outbox):
    tok = _email_verified_signup(client, outbox)
    assert _send(client, tok).status_code == 200
    code = outbox.sms[-1]["code"]
    for _ in range(5):
        assert _verify(client, tok, wrong_code(code)).status_code == 400
    assert _verify(client, tok, code).status_code == 400          # locked
    assert get_user("alice").phone_verified_at is None


def test_correct_code_cannot_be_replayed(client, outbox):
    tok = _email_verified_signup(client, outbox)
    _send(client, tok)
    code = outbox.sms[-1]["code"]
    assert _verify(client, tok, code).status_code == 200
    assert _verify(client, tok, code).status_code == 409


def test_expired_code_rejected(client, outbox):
    tok = _email_verified_signup(client, outbox)
    _send(client, tok)
    expire_challenges(get_user("alice").id, "phone_otp")
    assert _verify(client, tok, outbox.sms[-1]["code"]).status_code == 400


def test_sms_failure_returns_503_and_allows_retry(client, outbox):
    tok = _email_verified_signup(client, outbox)
    outbox.fail_sms = True
    assert _send(client, tok).status_code == 503
    assert outbox.sms == []
    outbox.fail_sms = False
    assert _send(client, tok).status_code == 200


def test_resend_cooldown(client, outbox):
    tok = _email_verified_signup(client, outbox)
    assert _send(client, tok).status_code == 200
    r = _send(client, tok)
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_hourly_sms_limit_per_phone(client, outbox):
    tok = _email_verified_signup(client, outbox)
    uid = get_user("alice").id
    for _ in range(5):
        limiter.reset(f"cd:phone:{uid}")
        assert _send(client, tok).status_code == 200
    limiter.reset(f"cd:phone:{uid}")
    assert _send(client, tok).status_code == 429


def test_phone_otp_stored_hashed(client, outbox):
    tok = _email_verified_signup(client, outbox)
    _send(client, tok)
    code = outbox.sms[-1]["code"]
    rows = [c for c in challenges(get_user("alice").id) if c.purpose == "phone_otp"]
    assert len(rows) == 1 and rows[0].code_hash != code and len(rows[0].code_hash) == 64


# ---- MSG91 provider code (HTTP is mocked; real MSG91 is NOT tested) ----
class _Resp:
    def __init__(self, status=200, data=None):
        self.status_code, self._data, self.content = status, data or {}, b"x"

    def json(self):
        return self._data


@pytest.fixture
def msg91(monkeypatch):
    monkeypatch.setattr(settings, "MSG91_AUTH_KEY", "test-key")
    monkeypatch.setattr(settings, "MSG91_TEMPLATE_ID", "tmpl")


def test_unconfigured_provider_raises(monkeypatch):
    monkeypatch.setattr(settings, "MSG91_AUTH_KEY", "")
    with pytest.raises(delivery.DeliveryError):
        delivery.send_sms_otp("+14155552671", "123456")


def test_provider_success_payload(msg91, monkeypatch):
    seen = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, headers=headers, json=json)
        return _Resp(200, {"type": "success"})
    monkeypatch.setattr(delivery.httpx, "post", fake_post)
    delivery.send_sms_otp("+14155552671", "123456")
    assert seen["headers"]["authkey"] == "test-key"
    assert seen["json"]["recipients"] == [{"mobiles": "14155552671", "otp": "123456"}]


@pytest.mark.parametrize("outcome", ["timeout", "http500", "type_error"])
def test_provider_failures_raise_and_never_log_the_code(msg91, monkeypatch, caplog, outcome):
    def fake_post(url, headers, json, timeout):
        if outcome == "timeout":
            raise httpx.ConnectTimeout("slow")
        return _Resp(500, {}) if outcome == "http500" else _Resp(200, {"type": "error"})
    monkeypatch.setattr(delivery.httpx, "post", fake_post)
    with caplog.at_level(logging.DEBUG):
        with pytest.raises(delivery.DeliveryError):
            delivery.send_sms_otp("+14155552671", "987654")
    assert "987654" not in caplog.text and "test-key" not in caplog.text

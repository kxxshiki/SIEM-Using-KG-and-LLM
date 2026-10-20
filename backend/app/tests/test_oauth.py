from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import settings
from app.db.postgres import SessionLocal
from app.main import app
from app.ml.models.user import User, UserRole
from app.models.oauth_identity import OAuthIdentity
from app.services import oauth_service as oa
from tests.helpers import API, GOOD_PW, PHONE, bearer, get_user, login, make_user, set_user

OAUTH = f"{API}/oauth"


@pytest.fixture(autouse=True)
def _configured(monkeypatch):
    for name, value in (("GOOGLE_CLIENT_ID", "gid"), ("GOOGLE_CLIENT_SECRET", "gsecret"),
                        ("GITHUB_CLIENT_ID", "hid"), ("GITHUB_CLIENT_SECRET", "hsecret"),
                        ("FRONTEND_URL", "http://frontend.test")):
        monkeypatch.setattr(settings, name, value)


def profile(sub="g-1", email="new@example.com", verified=True, name="New Person"):
    return oa.Profile(subject=sub, email=email, email_verified=verified, name=name)


def _fake(monkeypatch, prof):
    monkeypatch.setattr(oa, "fetch_profile", lambda provider, code, need_email=True: prof)


def _start(client, provider="google", ticket=None):
    url = f"{OAUTH}/{provider}/start" + (f"?link_ticket={ticket}" if ticket else "")
    return client.get(url, follow_redirects=False)


def _state(resp):
    return parse_qs(urlparse(resp.headers["location"]).query)["state"][0]


def _where(resp):
    u = urlparse(resp.headers["location"])
    return u.path, {k: v[0] for k, v in parse_qs(u.query).items()}


def oauth_login(client, monkeypatch, prof, provider="google"):
    _fake(monkeypatch, prof)
    state = _state(_start(client, provider))
    r = client.get(f"{OAUTH}/{provider}/callback?code=abc&state={state}", follow_redirects=False)
    return _where(r)


def _link(client, monkeypatch, username, sub, email="x@gmail.com"):
    tok = login(client, username, GOOD_PW).json()["access_token"]
    ticket = client.post(f"{OAUTH}/google/link-ticket", headers=bearer(tok)).json()["ticket"]
    _fake(monkeypatch, profile(sub=sub, email=email))
    state = _state(_start(client, ticket=ticket))
    cb = client.get(f"{OAUTH}/google/callback?code=abc&state={state}", follow_redirects=False)
    return _where(cb), ticket


def _identities():
    with SessionLocal() as db:
        return list(db.execute(select(OAuthIdentity)).scalars())


def _user_count():
    with SessionLocal() as db:
        return db.execute(select(func.count()).select_from(User)).scalar_one()


# ---------- start / state ----------
def test_unconfigured_provider_redirects_with_error(client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    r = _start(client)
    assert _where(r) == ("/oauth/callback", {"error": "provider_unavailable"})


def test_start_redirects_to_each_provider_and_sets_http_only_cookie(client):
    g = _start(client, "google")
    assert g.headers["location"].startswith("https://accounts.google.com/")
    assert "oauth_nonce=" in g.headers["set-cookie"] and "HttpOnly" in g.headers["set-cookie"]
    assert _start(client, "github").headers["location"].startswith("https://github.com/login/oauth/authorize")


def test_provider_availability_endpoint(client, monkeypatch):
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "")
    assert client.get(f"{OAUTH}/providers").json() == {"google": True, "github": False}


def test_callback_from_a_different_browser_is_rejected(client, monkeypatch):
    _fake(monkeypatch, profile())
    state = _state(_start(client))
    other = TestClient(app)  # has no cookie
    r = other.get(f"{OAUTH}/google/callback?code=abc&state={state}", follow_redirects=False)
    assert _where(r)[1] == {"error": "invalid_state"}
    assert _user_count() == 0


def test_tampered_state_is_rejected(client, monkeypatch):
    _fake(monkeypatch, profile())
    _start(client)
    r = client.get(f"{OAUTH}/google/callback?code=abc&state=garbage", follow_redirects=False)
    assert _where(r)[1] == {"error": "invalid_state"}
    assert _user_count() == 0


def test_user_denying_access_is_reported(client):
    state = _state(_start(client))
    r = client.get(f"{OAUTH}/google/callback?error=access_denied&state={state}", follow_redirects=False)
    assert _where(r)[1] == {"error": "cancelled"}


def test_provider_failure_is_reported_safely(client, monkeypatch):
    def boom(provider, code, need_email=True):
        raise oa.OAuthError("provider_error")
    monkeypatch.setattr(oa, "fetch_profile", boom)
    state = _state(_start(client))
    r = client.get(f"{OAUTH}/google/callback?code=abc&state={state}", follow_redirects=False)
    assert _where(r)[1] == {"error": "provider_error"}


# ---------- sign-in rules ----------
def test_new_user_waits_for_approval_then_can_sign_in(client, monkeypatch):
    assert oauth_login(client, monkeypatch, profile()) == ("/oauth/callback", {"status": "awaiting_approval"})
    u = get_user("new")
    assert u.role.value == "analyst" and u.status == "awaiting_approval"
    assert u.email_verified_at is not None and u.phone_e164 is None

    make_user("root", role=UserRole.admin)
    h = bearer(login(client, "root", GOOD_PW).json()["access_token"])
    assert client.post(f"{API}/admin/users/{u.id}/approve", headers=h).status_code == 200

    _, q = oauth_login(client, monkeypatch, profile())
    ex = client.post(f"{OAUTH}/exchange", json={"token": q["code"]})
    assert ex.status_code == 200 and ex.json()["username"] == "new"
    assert client.get(f"{API}/me", headers=bearer(ex.json()["access_token"])).status_code == 200
    assert client.post(f"{OAUTH}/exchange", json={"token": q["code"]}).status_code == 400  # single use


def test_unverified_provider_email_is_refused(client, monkeypatch):
    _, q = oauth_login(client, monkeypatch, profile(verified=False))
    assert q == {"error": "no_verified_email"} and _user_count() == 0


def test_legacy_account_with_same_email_is_not_auto_linked(client, monkeypatch):
    make_user("bob", email="bob@example.com")     # active, no phone: like an old/seeded account
    _, q = oauth_login(client, monkeypatch, profile(sub="g-bob", email="bob@example.com"))
    assert q == {"error": "account_exists"} and _identities() == []


def test_fully_verified_local_account_links_and_survives_email_change(client, monkeypatch):
    make_user("carl", phone=PHONE)
    _, q = oauth_login(client, monkeypatch, profile(sub="g-carl", email="carl@example.com"))
    assert "code" in q
    assert [(i.provider, i.subject) for i in _identities()] == [("google", "g-carl")]
    # same provider account, different email: still the same user (matched by id, not email)
    _, q2 = oauth_login(client, monkeypatch, profile(sub="g-carl", email="other@example.com"))
    assert "code" in q2 and _user_count() == 1


def test_disabled_account_cannot_sign_in(client, monkeypatch):
    make_user("carl", phone=PHONE)
    oauth_login(client, monkeypatch, profile(sub="g-carl", email="carl@example.com"))
    set_user("carl", status="disabled")
    _, q = oauth_login(client, monkeypatch, profile(sub="g-carl", email="carl@example.com"))
    assert q == {"error": "account_disabled"}


def test_exchange_rejects_unknown_and_malformed_codes(client):
    assert client.post(f"{OAUTH}/exchange", json={"token": "x" * 30}).status_code == 400
    assert client.post(f"{OAUTH}/exchange", json={"token": "short"}).status_code == 422


# ---------- connecting a provider while signed in ----------
def test_signed_in_user_can_connect_then_sign_in_with_provider(client, monkeypatch):
    make_user("bob")
    (path, q), ticket = _link(client, monkeypatch, "bob", "g-bob", "whatever@gmail.com")
    assert (path, q) == ("/account/connections", {"linked": "google"})

    _, q = oauth_login(client, monkeypatch, profile(sub="g-bob", email="whatever@gmail.com"))
    ex = client.post(f"{OAUTH}/exchange", json={"token": q["code"]})
    assert ex.json()["username"] == "bob"

    assert _where(_start(client, ticket=ticket))[1] == {"error": "link_expired"}   # ticket is single use


def test_provider_account_cannot_be_linked_to_two_users(client, monkeypatch):
    make_user("bob")
    make_user("amy")
    assert _link(client, monkeypatch, "bob", "g-shared")[0][1] == {"linked": "google"}
    assert _link(client, monkeypatch, "amy", "g-shared")[0][1] == {"error": "already_linked_elsewhere"}


def test_link_ticket_requires_login(client):
    assert client.post(f"{OAUTH}/google/link-ticket").status_code == 401


# ---------- provider client code (HTTP is mocked; real providers are NOT contacted) ----------
def _mock_http(monkeypatch, handler):
    real = httpx.Client
    monkeypatch.setattr(oa.httpx, "Client",
                        lambda **kw: real(transport=httpx.MockTransport(handler), **kw))


def test_github_uses_the_primary_verified_email(monkeypatch):
    def handler(request):
        p = request.url.path
        if p == "/login/oauth/access_token":
            return httpx.Response(200, json={"access_token": "t"})
        if p == "/user":
            return httpx.Response(200, json={"id": 42, "login": "oct", "name": "Octo"})
        if p == "/user/emails":
            return httpx.Response(200, json=[
                {"email": "a@x.com", "primary": False, "verified": True},
                {"email": "B@x.com", "primary": True, "verified": True}])
        return httpx.Response(404)
    _mock_http(monkeypatch, handler)
    prof = oa.fetch_profile("github", "code")
    assert (prof.subject, prof.email, prof.email_verified) == ("42", "b@x.com", True)


def test_github_unverified_primary_email_is_not_trusted(monkeypatch):
    def handler(request):
        p = request.url.path
        if p == "/login/oauth/access_token":
            return httpx.Response(200, json={"access_token": "t"})
        if p == "/user":
            return httpx.Response(200, json={"id": 42, "login": "oct"})
        return httpx.Response(200, json=[{"email": "a@x.com", "primary": True, "verified": False}])
    _mock_http(monkeypatch, handler)
    prof = oa.fetch_profile("github", "code")
    assert prof.email is None and prof.email_verified is False


def test_github_bad_code_is_a_provider_error(monkeypatch):
    _mock_http(monkeypatch, lambda r: httpx.Response(200, json={"error": "bad_verification_code"}))
    with pytest.raises(oa.OAuthError):
        oa.fetch_profile("github", "code")


def test_google_profile_is_read_from_userinfo(monkeypatch):
    def handler(request):
        if request.url.path == "/token":
            return httpx.Response(200, json={"access_token": "t"})
        return httpx.Response(200, json={"sub": "s1", "email": "A@B.com",
                                         "email_verified": True, "name": "N"})
    _mock_http(monkeypatch, handler)
    prof = oa.fetch_profile("google", "code")
    assert (prof.subject, prof.email, prof.email_verified) == ("s1", "a@b.com", True)
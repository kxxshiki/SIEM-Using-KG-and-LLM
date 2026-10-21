from datetime import datetime, timedelta

from app.config import settings
from app.db.postgres import SessionLocal
from app.models.upload import Upload
from tests.helpers import API, GOOD_PW, bearer, login, make_user

SUMMARY = f"{API}/dashboard/summary"
ALERTS = f"{API}/alerts"


def _add_upload(username, logs=5, alerts=0, age_minutes=0):
    with SessionLocal() as db:
        db.add(Upload(username=username, filename="t.log", logs_parsed=logs, alerts_created=alerts,
                      created_at=datetime.utcnow() - timedelta(minutes=age_minutes)))
        db.commit()


def _login(client, name="bob"):
    return bearer(login(client, name, GOOD_PW).json()["access_token"])


def test_fresh_sign_in_is_empty(client):
    make_user("bob")
    h = _login(client)
    body = client.get(SUMMARY, headers=h).json()
    assert body["has_data"] is False and body["total_logs"] == 0 and body["threat_trend"] == []
    assert client.get(ALERTS, headers=h).json() == {"total": 0, "alerts": []}


def test_only_uploads_from_this_sign_in_are_shown(client):
    make_user("bob")
    _add_upload("bob", logs=9, age_minutes=60)          # an earlier sign-in
    h = _login(client)
    assert client.get(SUMMARY, headers=h).json()["has_data"] is False
    _add_upload("bob", logs=5)                           # after signing in
    body = client.get(SUMMARY, headers=h).json()
    assert body["has_data"] is True and body["total_logs"] == 5


def test_other_users_uploads_are_never_shown(client):
    make_user("bob")
    make_user("amy")
    h = _login(client, "bob")
    _add_upload("amy")
    assert client.get(SUMMARY, headers=h).json()["has_data"] is False


def test_user_scope_includes_earlier_uploads(client, monkeypatch):
    monkeypatch.setattr(settings, "DATA_SCOPE", "user")
    make_user("bob")
    _add_upload("bob", logs=9, age_minutes=60)
    body = client.get(SUMMARY, headers=_login(client)).json()
    assert body["has_data"] is True and body["total_logs"] == 9


def test_summary_requires_login(client):
    assert client.get(SUMMARY).status_code == 401
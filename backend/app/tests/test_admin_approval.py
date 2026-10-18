from app.config import settings
from app.ml.models.user import UserRole
from app.tests.helpers import API, GOOD_PW, bearer, complete_signup, get_user, login, make_user

PENDING = f"{API}/admin/pending-users"


def _admin(client):
    make_user("root", role=UserRole.admin)
    return bearer(login(client, "root", GOOD_PW).json()["access_token"])


def test_approval_flow(client, outbox):
    complete_signup(client, outbox)
    assert login(client, "alice", GOOD_PW).json()["detail"]["code"] == "approval_required"
    h = _admin(client)
    r = client.get(PENDING, headers=h)
    assert r.status_code == 200 and [u["username"] for u in r.json()] == ["alice"]
    assert "hashed_password" not in r.text
    uid = get_user("alice").id
    assert client.post(f"{API}/admin/users/{uid}/approve", headers=h).status_code == 200
    assert login(client, "alice", GOOD_PW).status_code == 200


def test_reject_disables_and_revokes(client, outbox):
    vtok = complete_signup(client, outbox)
    h = _admin(client)
    uid = get_user("alice").id
    assert client.post(f"{API}/admin/users/{uid}/reject", headers=h).status_code == 200
    assert get_user("alice").status == "disabled"
    assert login(client, "alice", GOOD_PW).json()["detail"]["code"] == "account_disabled"
    assert client.get(f"{API}/verification-status", headers=bearer(vtok)).status_code == 401


def test_wrong_state_and_unknown_user(client):
    make_user("bob")                                   # already active
    h = _admin(client)
    assert client.post(f"{API}/admin/users/{get_user('bob').id}/approve", headers=h).status_code == 409
    assert client.post(f"{API}/admin/users/99999/approve", headers=h).status_code == 404


def test_only_admins_can_approve(client, outbox):
    complete_signup(client, outbox)
    uid = get_user("alice").id
    make_user("analyst1")
    t = bearer(login(client, "analyst1", GOOD_PW).json()["access_token"])
    assert client.get(PENDING, headers=t).status_code == 403
    assert client.post(f"{API}/admin/users/{uid}/approve", headers=t).status_code == 403
    assert client.get(PENDING).status_code == 401
    assert client.post(f"{API}/admin/users/{uid}/approve").status_code == 401
    assert get_user("alice").status == "awaiting_approval"


def test_setting_off_means_no_approval_needed(client, outbox, monkeypatch):
    monkeypatch.setattr(settings, "REQUIRE_ADMIN_APPROVAL", False)
    complete_signup(client, outbox)
    assert login(client, "alice", GOOD_PW).status_code == 200

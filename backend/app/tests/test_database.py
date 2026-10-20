import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db.postgres import engine
from app.tests.helpers import PHONE, challenges, get_user, make_user


def test_phone_is_unique():
    make_user("a", phone=PHONE)
    with pytest.raises(IntegrityError):
        make_user("b", phone=PHONE)


def test_email_is_unique_ignoring_case():
    make_user("a", email="X@Y.com")
    with pytest.raises(IntegrityError):
        make_user("b", email="x@y.COM")


def test_legacy_users_without_phone_coexist():
    make_user("a")
    make_user("b")

def test_challenges_are_deleted_with_their_user(client, outbox):
    from tests.helpers import GOOD_PW, bearer, login
    make_user("alice", status="pending", email="alice@example.com", phone=PHONE)
    tok = login(client, "alice", GOOD_PW).json()["detail"]["verification_token"]
    assert client.post("/api/v1/auth/resend-email", headers=bearer(tok)).status_code == 200
    uid = get_user("alice").id
    assert challenges(uid)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM users WHERE id = :i"), {"i": uid})
    assert challenges(uid) == []

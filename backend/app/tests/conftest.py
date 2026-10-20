import os

import pytest

_TEST_DB = os.environ.get("TEST_DATABASE_URL", "")
if not _TEST_DB:
    pytest.exit("Set TEST_DATABASE_URL to a PostgreSQL database whose name contains 'test'.",
                returncode=2)
_db_name = _TEST_DB.rsplit("/", 1)[-1].split("?")[0].lower()
if "test" not in _db_name:
    pytest.exit(f"Refusing to run: database '{_db_name}' must contain 'test' "
                "(these tests drop tables).", returncode=2)

# Real environment variables beat .env, so this isolates the tests from your dev config.
os.environ.update({
    "DATABASE_URL": _TEST_DB,
    "ENV": "development",
    "REDIS_ENABLED": "false",
    "SECRET_KEY": "test-secret-key-0123456789abcdef0123456789",
    "SEED_DEFAULT_USERS": "false",
    "DEV_CONSOLE_DELIVERY": "false",
    "FRONTEND_URL": "http://testserver",
    "NEO4J_URI": "",
    "REQUIRE_ADMIN_APPROVAL": "true",
    "LOGIN_MAX_ATTEMPTS": "5",
    "OTP_MAX_ATTEMPTS": "5",
})

from fastapi.testclient import TestClient  # noqa: E402
from passlib.context import CryptContext  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core import limiter, security  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.postgres import engine  # noqa: E402
from app.main import app  # noqa: E402  (also registers every model)
from app.services import delivery_service as delivery  # noqa: E402
from app.tests.helpers import Outbox  # noqa: E402
from tests import helpers


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def _fast_hashing():
    """Argon2id with tiny cost so the suite is fast. Production settings stay in security.py."""
    mp = pytest.MonkeyPatch()
    mp.setattr(security, "pwd_context", CryptContext(
        schemes=["argon2", "bcrypt"], deprecated=["bcrypt"], argon2__type="ID",
        argon2__memory_cost=512, argon2__time_cost=1, argon2__parallelism=1))
    yield
    mp.undo()


@pytest.fixture(autouse=True)
def _clean():
    with engine.begin() as conn:
                conn.execute(text(
            "TRUNCATE TABLE auth_challenges, signup_email_codes, users RESTART IDENTITY CASCADE"))
    limiter._mem.clear()
    limiter._client = None
    yield


@pytest.fixture
def client():
    return TestClient(app)  # no `with`: startup seeding / Neo4j setup do not run


@pytest.fixture
def outbox(monkeypatch):
    box = Outbox()

    def fake_email(to, subject, text_body, html_body):
        if box.fail_email:
            raise delivery.DeliveryError("simulated failure")
        box.emails.append({"to": to, "subject": subject, "text": text_body})

    def fake_sms(phone, code):
        if box.fail_sms:
            raise delivery.DeliveryError("simulated failure")
        box.sms.append({"to": phone, "code": code})

    monkeypatch.setattr(delivery, "send_email", fake_email)
    monkeypatch.setattr(delivery, "send_sms_otp", fake_sms)
    helpers.ACTIVE_OUTBOX = box
    yield box
    helpers.ACTIVE_OUTBOX = None


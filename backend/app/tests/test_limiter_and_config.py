import time

import pytest
import redis
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import Settings, settings
from app.core import limiter


class BrokenRedis:
    def __getattr__(self, name):
        def boom(*a, **k):
            raise redis.RedisError("down")
        return boom


def test_counter_counts_and_expires():
    assert limiter.hit("t:k", 1) == 1 and limiter.hit("t:k", 1) == 2
    assert limiter.count("t:k") == 2
    time.sleep(1.2)
    assert limiter.count("t:k") == 0


def test_cooldown_allows_one_caller_per_window():
    assert limiter.acquire("cd:t", 1) is True
    assert limiter.acquire("cd:t", 1) is False
    time.sleep(1.2)
    assert limiter.acquire("cd:t", 1) is True


def test_development_falls_back_to_memory_when_redis_is_down(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_ENABLED", True)
    monkeypatch.setattr(limiter, "_client", BrokenRedis())
    assert limiter.hit("t:dev", 60) == 1


def test_production_fails_closed_when_redis_is_down(monkeypatch):
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "REDIS_ENABLED", True)
    monkeypatch.setattr(limiter, "_client", BrokenRedis())
    with pytest.raises(HTTPException) as exc:
        limiter.hit("t:prod", 60)
    assert exc.value.status_code == 503


def test_counters_work_against_fake_redis(monkeypatch):
    fakeredis = pytest.importorskip("fakeredis")
    monkeypatch.setattr(settings, "REDIS_ENABLED", True)
    monkeypatch.setattr(limiter, "_client", fakeredis.FakeRedis(decode_responses=True))
    assert limiter.hit("t:r", 60) == 1 and limiter.hit("t:r", 60) == 2
    assert 0 < limiter.ttl("t:r") <= 60
    assert limiter.acquire("cd:r", 60) is True and limiter.acquire("cd:r", 60) is False
    limiter.reset("t:r")
    assert limiter.count("t:r") == 0


def _prod(**kw):
    base = dict(_env_file=None, DATABASE_URL="postgresql://u:p@localhost/siem_test",
                ENV="production", SECRET_KEY="x" * 40, REDIS_ENABLED=True,
                DEV_CONSOLE_DELIVERY=False, SEED_DEFAULT_USERS=False)
    base.update(kw)
    return Settings(**base)


def test_valid_production_config_loads():
    assert _prod().is_production


@pytest.mark.parametrize("bad", [
    {"SECRET_KEY": "change-this-secret-key"},
    {"SECRET_KEY": "too-short"},
    {"REDIS_ENABLED": False},
    {"DEV_CONSOLE_DELIVERY": True},
    {"SEED_DEFAULT_USERS": True},
])
def test_unsafe_production_config_refuses_to_start(bad):
    with pytest.raises(ValidationError):
        _prod(**bad)

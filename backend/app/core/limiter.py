import logging
import threading
import time
from typing import Dict, Optional, Tuple

import redis
from fastapi import HTTPException

from app.config import settings

log = logging.getLogger("siem.limiter")
_lock = threading.Lock()
_mem: Dict[str, Tuple[int, float]] = {}
_client: Optional["redis.Redis"] = None
_down_until = 0.0   # development only: do not retry Redis until this time


def _redis():
    global _client
    if not settings.REDIS_ENABLED:
        return None
    if not settings.is_production and time.time() < _down_until:
        return None  # Redis failed a moment ago; do not wait for it again
    if _client is None:
        _client = redis.Redis.from_url(
            settings.REDIS_URL, decode_responses=True,
            socket_timeout=0.3, socket_connect_timeout=0.3,
        )
    return _client


def _fail(exc: Exception) -> None:
    global _down_until
    if settings.is_production:
        log.error("Redis unavailable: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
    _down_until = time.time() + 30
    log.warning("Redis unavailable, using the in-memory limiter for 30 s (development only). "
                "Set REDIS_ENABLED=false if you do not run Redis locally.")


def _live(key: str) -> Tuple[int, float]:
    val, exp = _mem.get(key, (0, 0.0))
    if exp <= time.time():
        _mem.pop(key, None)
        return 0, 0.0
    return val, exp


def hit(key: str, window: int) -> int:
    """Count one event; return the count inside the current window."""
    r = _redis()
    if r is not None:
        try:
            n = int(r.incr(key))
            if n == 1 or r.ttl(key) < 0:
                r.expire(key, window)
            return n
        except redis.RedisError as exc:
            _fail(exc)
    with _lock:
        val, exp = _live(key)
        if not exp:
            exp = time.time() + window
        _mem[key] = (val + 1, exp)
        return val + 1


def count(key: str) -> int:
    r = _redis()
    if r is not None:
        try:
            return int(r.get(key) or 0)
        except redis.RedisError as exc:
            _fail(exc)
    with _lock:
        return _live(key)[0]


def ttl(key: str) -> int:
    r = _redis()
    if r is not None:
        try:
            return max(int(r.ttl(key)), 0)
        except redis.RedisError as exc:
            _fail(exc)
    with _lock:
        return max(int(_live(key)[1] - time.time()), 0)


def reset(key: str) -> None:
    r = _redis()
    if r is not None:
        try:
            r.delete(key)
            return
        except redis.RedisError as exc:
            _fail(exc)
    with _lock:
        _mem.pop(key, None)


def acquire(key: str, seconds: int) -> bool:
    """Cooldown: True if the caller may proceed, False if still cooling down."""
    r = _redis()
    if r is not None:
        try:
            return bool(r.set(key, "1", nx=True, ex=seconds))
        except redis.RedisError as exc:
            _fail(exc)
    with _lock:
        if _live(key)[1]:
            return False
        _mem[key] = (1, time.time() + seconds)
        return True


release = reset
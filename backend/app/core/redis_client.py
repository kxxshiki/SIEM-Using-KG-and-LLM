
import json
from typing import Any, Dict, List, Optional, Tuple

import redis

from app.config import settings


redis_client = None

if settings.REDIS_ENABLED:
    redis_client = redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
    )


# ---------------------------------------------------------------------------
# CACHE
# ---------------------------------------------------------------------------

def cache_set(
    key: str,
    value: Any,
    ttl_seconds: int = 60,
) -> None:
    if redis_client is None:
        return

    redis_client.setex(
        name=key,
        time=ttl_seconds,
        value=json.dumps(value),
    )


def cache_get(key: str) -> Optional[Any]:
    if redis_client is None:
        return None

    raw_value = redis_client.get(key)

    if raw_value is None:
        return None

    return json.loads(raw_value)


def cache_delete(key: str) -> None:
    if redis_client is not None:
        redis_client.delete(key)


# ---------------------------------------------------------------------------
# RATE LIMITING
# ---------------------------------------------------------------------------

def rate_limit_check(
    key: str,
    max_attempts: int,
    window_seconds: int,
) -> bool:
    if redis_client is None:
        return True

    pipe = redis_client.pipeline(transaction=True)
    pipe.incr(key)
    pipe.expire(key, window_seconds, nx=True)

    current_count, _ = pipe.execute()

    return int(current_count) <= max_attempts


# ---------------------------------------------------------------------------
# SINGLE COUNTER
# ---------------------------------------------------------------------------

def increment_and_get_count(
    key: str,
    ttl_seconds: int,
) -> int:
    if redis_client is None:
        return 0

    pipe = redis_client.pipeline(transaction=True)
    pipe.incr(key)
    pipe.expire(key, ttl_seconds, nx=True)

    current_count, _ = pipe.execute()

    return int(current_count)


# ---------------------------------------------------------------------------
# BATCH COUNTERS — COMPATIBILITY API
# ---------------------------------------------------------------------------

def increment_and_get_counts_batch(
    items: List[Tuple[str, int]],
) -> Dict[str, int]:
    """
    Increment counters using a single pipeline.

    Returns the final count for each unique key. If a key appears multiple
    times, its final count is returned once. Use the per-item API below
    when individual results are needed.
    """
    if not items:
        return {}

    if redis_client is None:
        return {key: 0 for key, _ in items}

    pipe = redis_client.pipeline(transaction=False)

    for key, ttl_seconds in items:
        pipe.incr(key)
        pipe.expire(key, ttl_seconds, nx=True)

    results = pipe.execute()

    counts: Dict[str, int] = {}

    for index, (key, _) in enumerate(items):
        counts[key] = int(results[index * 2])

    return counts


# ---------------------------------------------------------------------------
# BATCH COUNTERS — PER-ITEM API
# ---------------------------------------------------------------------------

def increment_and_get_counts_batch_per_item(
    items: List[Tuple[str, int]],
) -> List[int]:
    """
    Increment each counter and return one result per input item, in order.

    Duplicate keys are supported. Each result reflects the count immediately
    after that item's increment, including earlier increments in this batch.

    Note: this preserves counter semantics, but does not make a collection of
    separate log events an exact timestamp-based sliding-window calculation.
    """
    if not items:
        return []

    if redis_client is None:
        return [0] * len(items)

    pipe = redis_client.pipeline(transaction=False)

    for key, ttl_seconds in items:
        pipe.incr(key)
        pipe.expire(key, ttl_seconds, nx=True)

    results = pipe.execute()

    return [
        int(results[index * 2])
        for index in range(len(items))
    ]

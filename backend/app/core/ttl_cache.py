
import threading
import time
from typing import Any, Callable, Dict, Tuple

_lock = threading.Lock()
_store: Dict[str, Tuple[float, Any]] = {}
MAX_ENTRIES = 300


def cached(
    key: str,
    ttl: float,
    builder: Callable[[], Any],
    force: bool = False,
) -> Any:
    """Small thread-safe in-memory cache."""
    now = time.time()

    with _lock:
        hit = _store.get(key)
        if not force and hit and now - hit[0] < ttl:
            return hit[1]

    value = builder()

    with _lock:
        _store[key] = (time.time(), value)

        if len(_store) > MAX_ENTRIES:
            oldest = sorted(_store, key=lambda k: _store[k][0])
            for old_key in oldest[: len(_store) - MAX_ENTRIES]:
                _store.pop(old_key, None)

    return value


def invalidate(key: str) -> None:
    """Invalidate one cache entry."""
    with _lock:
        _store.pop(key, None)


def invalidate_prefix(prefix: str) -> None:
    """Invalidate entries whose keys start with the given prefix."""
    with _lock:
        for key in list(_store):
            if key.startswith(prefix):
                _store.pop(key, None)


def clear() -> None:
    """Clear all cached entries."""
    with _lock:
        _store.clear()

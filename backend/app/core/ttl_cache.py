import threading
import time
from typing import Any, Callable, Dict, Tuple

_lock = threading.Lock()
_store: Dict[str, Tuple[float, Any]] = {}
MAX_ENTRIES = 300


def cached(key: str, ttl: float, builder: Callable[[], Any], force: bool = False) -> Any:
    """Small in-memory cache. Works with or without Redis."""
    now = time.time()
    if not force:
        hit = _store.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    value = builder()
    with _lock:
        _store[key] = (time.time(), value)
        if len(_store) > MAX_ENTRIES:
            for old in sorted(_store, key=lambda k: _store[k][0])[: len(_store) - MAX_ENTRIES]:
                _store.pop(old, None)
    return value


def clear() -> None:
    with _lock:
        _store.clear()
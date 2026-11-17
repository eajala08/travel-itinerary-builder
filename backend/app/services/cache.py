import time
from typing import Any, Optional

_MAX_ENTRIES = 500
_store: dict[str, tuple[float, Any]] = {}


def get(key: str) -> Optional[Any]:
    entry = _store.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if expires_at < time.monotonic():
        _store.pop(key, None)
        return None
    return value


def put(key: str, value: Any, ttl_seconds: float) -> None:
    if len(_store) >= _MAX_ENTRIES:
        _store.clear()
    _store[key] = (time.monotonic() + ttl_seconds, value)


def clear() -> None:
    _store.clear()

import math
import time
from collections import defaultdict, deque

from fastapi import HTTPException

# shortcut: kept in memory, so each serverless instance counts separately; move to a DB table if abused
_logs: dict[str, deque] = defaultdict(deque)


def check(key: str, limits: list[tuple[int, int]], what: str) -> None:
    """Raise 429 if `key` already used up any (max, window_seconds) limit. Limits: shortest window first."""
    now = time.time()
    log = _logs[key]
    while log and now - log[0] > limits[-1][1]:
        log.popleft()
    for limit, window in limits:
        recent = [t for t in log if now - t <= window]
        if len(recent) >= limit:
            wait_min = max(1, math.ceil((recent[0] + window - now) / 60))
            raise HTTPException(
                status_code=429,
                detail=f"Too many {what} ({limit} per {window // 60} minutes). Try again in {wait_min} minute{'s' if wait_min != 1 else ''}.",
            )


def record(key: str) -> None:
    _logs[key].append(time.time())


def clear(key: str) -> None:
    _logs.pop(key, None)

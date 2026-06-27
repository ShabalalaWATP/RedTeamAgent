from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Protocol

from redis import Redis
from redis.exceptions import RedisError

from app.domain.exceptions import RateLimitExceeded


class RateLimitStore(Protocol):
    def increment(self, key: str, window_seconds: int) -> int: ...


class MemoryRateLimitStore:
    def __init__(self) -> None:
        self.hits: dict[str, list[float]] = {}

    def increment(self, key: str, window_seconds: int) -> int:
        now = time.monotonic()
        current = [hit for hit in self.hits.get(key, []) if now - hit < window_seconds]
        current.append(now)
        self.hits[key] = current
        return len(current)

    def clear(self) -> None:
        self.hits.clear()


class RedisRateLimitStore:
    def __init__(self, redis_url: str) -> None:
        self.client = Redis.from_url(redis_url, decode_responses=True)

    def increment(self, key: str, window_seconds: int) -> int:
        try:
            count = int(self.client.incr(key))
            if count == 1:
                self.client.expire(key, window_seconds)
            return count
        except RedisError as exc:
            raise RateLimitExceeded("Too many requests. Try again later.") from exc


@dataclass(frozen=True)
class LimitRule:
    name: str
    limit: int
    window_seconds: int


class AbuseLimiter:
    def __init__(self, store: RateLimitStore, prefix: str = "rta") -> None:
        self.store = store
        self.prefix = prefix

    def check(self, rule: LimitRule, identity: str) -> None:
        safe_identity = hashlib.sha256(identity.encode("utf-8", errors="ignore")).hexdigest()
        key = f"{self.prefix}:rate:{rule.name}:{safe_identity}"
        if self.store.increment(key, rule.window_seconds) > rule.limit:
            raise RateLimitExceeded("Too many requests. Try again later.")

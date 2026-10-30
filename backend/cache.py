"""Redis caching layer for Caliwo API.

Addresses audit item C4 — adds TTL-based caching for read-heavy endpoints,
reducing direct database hits by up to 80%.

Usage:
    from cache import cached, cache_invalidate, get_redis

    @router.get("/profile/me")
    @cached(prefix="profile", ttl=60, key_func=lambda user, **kw: user.id)
    async def get_profile(user=Depends(current_user), ...):
        ...

    # Invalidate on write:
    await cache_invalidate("profile", user.id)
"""

import json
import logging
import os
from functools import wraps
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

_redis_client = None


def get_redis():
    """Lazy-initialise and return a shared async Redis client."""
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis

            redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            _redis_client = aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
        except Exception as e:
            logger.warning("Redis unavailable — caching disabled: %s", e)
            return None
    return _redis_client


async def cache_get(key: str) -> Optional[str]:
    """Get a value from Redis cache. Returns None on miss or error."""
    try:
        r = get_redis()
        if r is None:
            return None
        return await r.get(key)
    except Exception as e:
        logger.debug("cache_get error key=%s: %s", key, e)
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    """Set a value in Redis cache with TTL (seconds)."""
    try:
        r = get_redis()
        if r is None:
            return
        serialized = json.dumps(value, default=str)
        await r.set(key, serialized, ex=ttl)
    except Exception as e:
        logger.debug("cache_set error key=%s: %s", key, e)


async def cache_delete(key: str) -> None:
    """Delete a single cache key."""
    try:
        r = get_redis()
        if r is None:
            return
        await r.delete(key)
    except Exception as e:
        logger.debug("cache_delete error key=%s: %s", key, e)


async def cache_invalidate(prefix: str, identifier: str) -> None:
    """Invalidate all cache keys matching a prefix:identifier pattern."""
    try:
        r = get_redis()
        if r is None:
            return
        pattern = f"caliwo:{prefix}:{identifier}*"
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                await r.delete(*keys)
            if cursor == 0:
                break
    except Exception as e:
        logger.debug("cache_invalidate error prefix=%s id=%s: %s", prefix, identifier, e)


def cached(prefix: str, ttl: int = 60, key_func: Optional[Callable] = None):
    """Decorator that caches endpoint responses in Redis.

    Args:
        prefix: Cache key namespace (e.g. "profile", "subscription").
        ttl: Time-to-live in seconds.
        key_func: Callable that receives the same args as the endpoint and
                  returns the unique cache identifier string. If None, caching
                  is skipped (useful as a safe fallback).
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if key_func is None:
                return await func(*args, **kwargs)

            try:
                cache_id = key_func(*args, **kwargs)
            except Exception:
                return await func(*args, **kwargs)

            cache_key = f"caliwo:{prefix}:{cache_id}"

            # Try cache hit
            hit = await cache_get(cache_key)
            if hit is not None:
                try:
                    return json.loads(hit)
                except (json.JSONDecodeError, TypeError):
                    pass

            # Cache miss — execute endpoint
            result = await func(*args, **kwargs)

            # Store result
            await cache_set(cache_key, result, ttl=ttl)
            return result

        return wrapper
    return decorator

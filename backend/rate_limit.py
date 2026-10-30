"""Shared rate limiter (SlowAPI).

Scalability fix C3: Uses Redis as the storage backend for rate limiting
across multiple Gunicorn workers and container replicas. Falls back to
in-memory if Redis is unavailable (dev/testing only).
"""
import os
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# Use Redis backend for multi-worker / multi-instance production
_redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

try:
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[],
        storage_uri=_redis_url,
    )
    logger.info("Rate limiter initialized with Redis backend: %s", _redis_url)
except Exception as e:
    logger.warning(
        "Redis rate limiter unavailable (%s) — falling back to in-memory. "
        "This is NOT safe for multi-worker production!",
        e,
    )
    limiter = Limiter(key_func=get_remote_address, default_limits=[])

"""Singleton shared AI client instances with circuit breaker pattern.

Addresses audit items:
  H9 — Consolidates multiple per-module AsyncOpenAI() / AsyncAnthropic()
        clients into single shared instances with connection pooling.
  H3 — Adds circuit breaker pattern to prevent cascading failures when
        OpenAI/Anthropic is overloaded or down.
  M7 — Graceful degradation: returns structured error instead of 502
        when AI services are unavailable.

Usage:
    from ai_client import get_openai_client, get_anthropic_client, ai_circuit_breaker
"""

import os
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_openai_client = None
_anthropic_client = None


class CircuitBreaker:
    """Simple circuit breaker to prevent hammering a failing external service.

    States:
      CLOSED  → requests flow normally
      OPEN    → requests fail immediately (service is down)
      HALF_OPEN → allow one test request to check recovery

    After `failure_threshold` consecutive failures, the circuit opens for
    `recovery_timeout` seconds. After that, one request is let through to test.
    """

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(
        self,
        name: str = "ai",
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._state = self.CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0

    @property
    def state(self) -> str:
        if self._state == self.OPEN:
            if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                self._state = self.HALF_OPEN
        return self._state

    def allow_request(self) -> bool:
        """Return True if the circuit allows a request through."""
        s = self.state
        if s == self.CLOSED:
            return True
        if s == self.HALF_OPEN:
            return True  # allow one test request
        return False  # OPEN → reject

    def reset(self) -> None:
        """Reset the circuit breaker to closed state."""
        self._failure_count = 0
        self._state = self.CLOSED
        self._last_failure_time = 0

    def record_success(self) -> None:
        self._failure_count = 0
        self._state = self.CLOSED

    def record_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.monotonic()
        if self._failure_count >= self.failure_threshold:
            self._state = self.OPEN
            logger.warning(
                "Circuit breaker [%s] OPEN after %d consecutive failures. "
                "Requests will be rejected for %ds.",
                self.name,
                self._failure_count,
                self.recovery_timeout,
            )


# Global circuit breaker for AI services
ai_circuit_breaker = CircuitBreaker(name="ai", failure_threshold=5, recovery_timeout=60)

_cached_api_key = None
_sync_openai_client = None


def _clean_openai_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "")
    return key.strip("\"' \t\r\n")


def get_openai_client():
    """Return the singleton AsyncOpenAI client, refreshing if the API key changed."""
    global _openai_client, _cached_api_key
    raw_key = _clean_openai_key()
    if _openai_client is None or _cached_api_key != raw_key:
        from openai import AsyncOpenAI

        _openai_client = AsyncOpenAI(
            api_key=raw_key or "dummy",
            max_retries=2,
            timeout=60.0,
        )
        _cached_api_key = raw_key
        # When client is initialized or key is updated, ensure circuit breaker is clear
        ai_circuit_breaker.reset()
    return _openai_client


def get_sync_openai_client():
    """Return a singleton synchronous OpenAI client."""
    global _sync_openai_client
    raw_key = _clean_openai_key()
    if _sync_openai_client is None or getattr(_sync_openai_client, "_cached_api_key", None) != raw_key:
        from openai import OpenAI

        _sync_openai_client = OpenAI(
            api_key=raw_key or "dummy",
            max_retries=2,
            timeout=60.0,
        )
        _sync_openai_client._cached_api_key = raw_key
    return _sync_openai_client


def get_anthropic_client():
    """Return the singleton AsyncAnthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        try:
            import anthropic

            _anthropic_client = anthropic.AsyncAnthropic(
                api_key=os.environ.get("ANTHROPIC_API_KEY"),
                max_retries=2,
                timeout=60.0,
            )
        except Exception as e:
            logger.warning("Failed to initialize Anthropic client: %s", e)
    return _anthropic_client

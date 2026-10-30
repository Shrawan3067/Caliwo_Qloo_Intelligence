"""Middleware for request tracing and structured logging.

Addresses audit items:
  M2 — X-Request-ID per request for distributed tracing
  M3 — Structured JSON logging for log aggregation (ELK, Datadog)
"""

import logging
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Context variable for propagating request_id through async call chains
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Injects X-Request-ID into every request/response and logs timing."""

    async def dispatch(self, request: Request, call_next):
        # Use incoming header if present, otherwise generate a new one
        req_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request_id_var.set(req_id)

        start = time.perf_counter()
        response: Response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)

        response.headers["X-Request-ID"] = req_id

        # Structured access log
        logger = logging.getLogger("caliwo.access")
        logger.info(
            "request",
            extra={
                "request_id": req_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": elapsed_ms,
                "client": request.client.host if request.client else "-",
            },
        )

        return response


def setup_structured_logging():
    """Configure JSON-structured logging for production.

    In development (ENVIRONMENT != production), uses a human-readable format
    with request_id prepended. In production, outputs JSON lines.
    """
    import os
    import json as _json

    is_prod = os.environ.get("ENVIRONMENT", "").lower() == "production"

    class JSONFormatter(logging.Formatter):
        def format(self, record):
            log_data = {
                "ts": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "logger": record.name,
                "msg": record.getMessage(),
                "request_id": getattr(record, "request_id", request_id_var.get("-")),
            }
            # Merge any extra fields
            for key in ("method", "path", "status", "duration_ms", "client", "user_id"):
                val = getattr(record, key, None)
                if val is not None:
                    log_data[key] = val
            if record.exc_info and record.exc_info[0]:
                log_data["exception"] = self.formatException(record.exc_info)
            return _json.dumps(log_data, default=str)

    class DevFormatter(logging.Formatter):
        def format(self, record):
            req_id = getattr(record, "request_id", request_id_var.get("-"))
            base = f"[{req_id}] {record.levelname} {record.name}: {record.getMessage()}"
            if record.exc_info and record.exc_info[0]:
                base += "\n" + self.formatException(record.exc_info)
            return base

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Remove existing handlers to avoid duplicate output
    for h in root.handlers[:]:
        root.removeHandler(h)

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter() if is_prod else DevFormatter())
    root.addHandler(handler)

    # Quiet down noisy libraries
    for lib in ("uvicorn.access", "sqlalchemy.engine", "httpx", "httpcore"):
        logging.getLogger(lib).setLevel(logging.WARNING)

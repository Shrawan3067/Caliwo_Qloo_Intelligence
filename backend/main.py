"""
Backward-compatibility entry point.

All application logic lives in server.py.  This module re-exports the
FastAPI `app` instance so that ``uvicorn main:app`` still works for
any existing deployment scripts or Docker CMD directives.

Canonical entry point:
    uvicorn server:app --host 0.0.0.0 --port 8000
"""

from server import app  # noqa: F401

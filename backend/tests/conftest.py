import os
import sys
from pathlib import Path
import pytest
import requests
import requests.adapters
import requests.structures
from starlette.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

os.environ["TESTING"] = "1"
# Only override DATABASE_URL if TEST_DATABASE_URL is explicitly set.
# Otherwise, use the real database from .env for E2E agent tests.
if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["EXPO_PUBLIC_BACKEND_URL"] = "http://testserver"
os.environ["CALIWO_TEST_URL"] = "http://testserver"
os.environ["REACT_APP_BACKEND_URL"] = "http://testserver"
os.environ["BASE_URL"] = "http://testserver"

from server import app

class FastAPIAdapter(requests.adapters.HTTPAdapter):
    def __init__(self, app):
        super().__init__()
        self.client = TestClient(app, raise_server_exceptions=True)

    def send(self, request, *args, **kwargs):  # type: ignore[override]
        method = request.method
        url = request.url
        headers = dict(request.headers)
        data = request.body

        resp = self.client.request(
            method=method,
            url=url,
            headers=headers,
            content=data,
        )

        r = requests.Response()
        r.status_code = resp.status_code
        r._content = resp.content
        r.headers = requests.structures.CaseInsensitiveDict(resp.headers)
        r.url = url
        return r

_adapter = FastAPIAdapter(app)

def _custom_send(self, request, **kwargs):
    return _adapter.send(request, **kwargs)

requests.Session.send = _custom_send

def pytest_configure(config):
    os.environ["TESTING"] = "1"
    os.environ["EXPO_PUBLIC_BACKEND_URL"] = "http://testserver"
    os.environ["CALIWO_TEST_URL"] = "http://testserver"
    os.environ["REACT_APP_BACKEND_URL"] = "http://testserver"
    os.environ["BASE_URL"] = "http://testserver"

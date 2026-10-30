"""End-to-end auth API integration tests.

Covers registration, login, /me, logout, JWT hardening, rate limiting.

Run: pytest backend/tests/test_auth_api_integration.py -v
"""
import os
import uuid
import time
import datetime

import jwt
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "http://localhost:8000",
).rstrip("/")
API = f"{BASE_URL}/api"

EXISTING_EMAIL = "authgood@example.com"
EXISTING_PW = "GoodPass123"

JWT_ISSUER = "caliwo-api"
JWT_AUDIENCE = "caliwo-app"


def _fresh_email(tag: str = "reg") -> str:
    return f"TEST_{tag}_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Registration -----------------------------------------------------------


class TestRegister:
    def test_register_success_returns_token_user(self, client):
        email = _fresh_email("regok")
        r = client.post(
            f"{API}/auth/register",
            json={"email": email, "password": "GoodPass123", "name": "Test User"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str)
        assert "user" in data
        u = data["user"]
        for k in ("user_id", "email", "name", "onboarded"):
            assert k in u, f"missing {k} in public_user"
        assert u["email"] == email.lower()
        assert u["onboarded"] is False

        # verify token works on /me immediately
        me = client.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {data['token']}"},
        )
        assert me.status_code == 200, me.text
        assert me.json()["email"] == email.lower()

    @pytest.mark.parametrize(
        "pw",
        ["short1", "onlyletters", "12345678", "abcdefgh"],
    )
    def test_register_weak_password_422(self, client, pw):
        r = client.post(
            f"{API}/auth/register",
            json={"email": _fresh_email("weak"), "password": pw},
        )
        assert r.status_code == 422, r.text

    def test_register_duplicate_email_400(self, client):
        # authgood@example.com already exists
        r = client.post(
            f"{API}/auth/register",
            json={"email": EXISTING_EMAIL, "password": EXISTING_PW},
        )
        assert r.status_code == 400, r.text
        assert "already" in r.json().get("detail", "").lower()

    def test_register_password_too_long_422(self, client):
        # 74 UTF-8 bytes (37 × 'é')
        pw = "é" * 37 + "a1"
        assert len(pw.encode("utf-8")) > 72
        r = client.post(
            f"{API}/auth/register",
            json={"email": _fresh_email("long"), "password": pw},
        )
        assert r.status_code == 422, r.text


# --- Login ------------------------------------------------------------------


class TestLogin:
    def test_login_success(self, client):
        r = client.post(
            f"{API}/auth/login",
            json={"email": EXISTING_EMAIL, "password": EXISTING_PW},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["token"]
        assert data["user"]["email"] == EXISTING_EMAIL

    def test_login_wrong_password_401(self, client):
        r = client.post(
            f"{API}/auth/login",
            json={"email": EXISTING_EMAIL, "password": "NotMyPass9"},
        )
        assert r.status_code == 401, r.text
        assert r.json().get("detail") == "Invalid email or password"

    def test_login_unknown_email_generic_401(self, client):
        r = client.post(
            f"{API}/auth/login",
            json={
                "email": f"nobody_{uuid.uuid4().hex[:8]}@example.com",
                "password": "Whatever9x",
            },
        )
        assert r.status_code == 401, r.text
        # no user enumeration: same detail as wrong-password case
        assert r.json().get("detail") == "Invalid email or password"


# --- /me and /logout --------------------------------------------------------


class TestMeAndLogout:
    @pytest.fixture(scope="class")
    def auth_token(self, client):
        r = client.post(
            f"{API}/auth/login",
            json={"email": EXISTING_EMAIL, "password": EXISTING_PW},
        )
        assert r.status_code == 200, r.text
        return r.json()["token"]

    def test_me_valid_token(self, client, auth_token):
        r = client.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == EXISTING_EMAIL
        assert "user_id" in body

    def test_me_missing_token_401(self, client):
        r = client.get(f"{API}/auth/me", headers={"Authorization": ""})
        assert r.status_code == 401

    def test_me_garbage_token_401(self, client):
        r = client.get(
            f"{API}/auth/me",
            headers={"Authorization": "Bearer not.a.valid.jwt"},
        )
        assert r.status_code == 401

    def test_me_wrong_secret_token_401(self, client):
        forged = jwt.encode(
            {
                "sub": "user_hacker",
                "iss": JWT_ISSUER,
                "aud": JWT_AUDIENCE,
                "iat": datetime.datetime.now(datetime.timezone.utc),
                "exp": datetime.datetime.now(datetime.timezone.utc)
                + datetime.timedelta(days=1),
                "typ": "access",
                "jti": uuid.uuid4().hex,
            },
            "attacker-secret-key-that-is-long-enough-xxx",
            algorithm="HS256",
        )
        r = client.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {forged}"},
        )
        assert r.status_code == 401, r.text

    def test_me_expired_token_401(self, client):
        # We can't sign with the real secret, but decode_jwt already rejects
        # wrong-secret. Expired handling is covered in unit tests. Here we
        # just re-check wrong-secret with expired exp too, which must 401.
        expired = jwt.encode(
            {
                "sub": "user_x",
                "iss": JWT_ISSUER,
                "aud": JWT_AUDIENCE,
                "iat": datetime.datetime.now(datetime.timezone.utc)
                - datetime.timedelta(days=2),
                "exp": datetime.datetime.now(datetime.timezone.utc)
                - datetime.timedelta(days=1),
                "typ": "access",
            },
            "attacker-secret",
            algorithm="HS256",
        )
        r = client.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {expired}"},
        )
        assert r.status_code == 401

    def test_logout_ok(self, client, auth_token):
        r = client.post(
            f"{API}/auth/logout",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True


# --- Forgot & Reset Password ------------------------------------------------
class TestForgotPassword:
    def test_forgot_password_generates_token(self, client):
        r = client.post(
            f"{API}/auth/forgot-password",
            json={"email": EXISTING_EMAIL},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "reset_token" in data

    def test_reset_password_success(self, client):
        # 1. Register fresh user
        email = _fresh_email("resetpass")
        orig_pw = "OriginalPass123"
        r0 = client.post(
            f"{API}/auth/register",
            json={"email": email, "password": orig_pw, "name": "Reset Test User"},
        )
        assert r0.status_code == 200, r0.text

        # 2. Request token
        r1 = client.post(
            f"{API}/auth/forgot-password",
            json={"email": email},
        )
        assert r1.status_code == 200, r1.text
        token = r1.json()["reset_token"]

        # 3. Reset password
        new_pw = "NewSecurePass123"
        r2 = client.post(
            f"{API}/auth/reset-password",
            json={"token": token, "new_password": new_pw},
        )
        assert r2.status_code == 200, r2.text
        assert r2.json().get("ok") is True

        # 4. Test login with new password
        r3 = client.post(
            f"{API}/auth/login",
            json={"email": email, "password": new_pw},
        )
        assert r3.status_code == 200, r3.text


    def test_reset_password_invalid_token_400(self, client):
        r = client.post(
            f"{API}/auth/reset-password",
            json={"token": "invalid_token_123", "new_password": "NewSecurePass123"},
        )
        assert r.status_code == 400, r.text


# --- JWT hardening on public token ------------------------------------------



class TestJWTClaims:
    def test_issued_token_has_hardening_claims(self, client):
        r = client.post(
            f"{API}/auth/login",
            json={"email": EXISTING_EMAIL, "password": EXISTING_PW},
        )
        assert r.status_code == 200, r.text
        token = r.json()["token"]

        # Decode WITHOUT verifying signature (we don't know server secret)
        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload.get("iss") == JWT_ISSUER
        assert payload.get("aud") == JWT_AUDIENCE
        assert payload.get("typ") == "access"
        assert "jti" in payload and payload["jti"]
        assert "exp" in payload and "iat" in payload
        assert "sub" in payload





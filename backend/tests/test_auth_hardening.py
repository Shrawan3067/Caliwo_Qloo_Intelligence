"""Auth hardening regression tests.

Covers: bcrypt round-trip, 72-byte UTF-8 enforcement, password strength policy,
and JWT claim generation/validation (issuer/audience/type/expiry).
Run: cd /app/backend && TESTING=1 python -m pytest tests/test_auth_hardening.py -q
"""
import os
import datetime

import jwt
import pytest
from fastapi import HTTPException

os.environ.setdefault("JWT_SECRET", "x" * 40)

from routers import auth  # noqa: E402


def test_bcrypt_round_trip():
    h = auth.hash_password("GoodPass123")
    assert auth.verify_password("GoodPass123", h)
    assert not auth.verify_password("WrongPass123", h)


def test_verify_rejects_malformed_hash():
    assert auth.verify_password("whatever", "not-a-bcrypt-hash") is False


def test_password_too_long_bytes_rejected():
    # 37 × 'é' = 74 UTF-8 bytes > 72 → must raise, never silently truncate.
    long_pw = "é" * 37 + "a1"
    assert len(long_pw.encode("utf-8")) > 72
    with pytest.raises(HTTPException) as ei:
        auth.hash_password(long_pw)
    assert ei.value.status_code == 422


@pytest.mark.parametrize(
    "pw",
    ["short1", "onlyletters", "12345678", "abcdefgh"],
)
def test_weak_passwords_rejected(pw):
    with pytest.raises(HTTPException) as ei:
        auth.validate_password_strength(pw)
    assert ei.value.status_code == 422


def test_strong_password_accepted():
    # Should not raise
    auth.validate_password_strength("GoodPass123")


def test_jwt_round_trip_and_claims():
    token = auth.make_jwt("user_abc")
    assert auth.decode_jwt(token) == "user_abc"
    payload = jwt.decode(
        token,
        auth.JWT_SECRET,
        algorithms=[auth.JWT_ALGO],
        audience=auth.JWT_AUDIENCE,
        issuer=auth.JWT_ISSUER,
    )
    assert payload["typ"] == "access"
    assert payload["iss"] == auth.JWT_ISSUER
    assert payload["aud"] == auth.JWT_AUDIENCE
    assert "jti" in payload


def test_jwt_wrong_secret_rejected():
    forged = jwt.encode(
        {
            "sub": "user_x",
            "iss": auth.JWT_ISSUER,
            "aud": auth.JWT_AUDIENCE,
            "iat": datetime.datetime.now(datetime.timezone.utc),
            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1),
        },
        "some-other-secret",
        algorithm="HS256",
    )
    assert auth.decode_jwt(forged) is None


def test_jwt_expired_rejected():
    expired = jwt.encode(
        {
            "sub": "user_x",
            "iss": auth.JWT_ISSUER,
            "aud": auth.JWT_AUDIENCE,
            "iat": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2),
            "exp": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
            "typ": "access",
        },
        auth.JWT_SECRET,
        algorithm="HS256",
    )
    assert auth.decode_jwt(expired) is None


def test_jwt_missing_type_rejected():
    no_typ = jwt.encode(
        {
            "sub": "user_x",
            "iss": auth.JWT_ISSUER,
            "aud": auth.JWT_AUDIENCE,
            "iat": datetime.datetime.now(datetime.timezone.utc),
            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1),
        },
        auth.JWT_SECRET,
        algorithm="HS256",
    )
    # typ != "access" → rejected
    assert auth.decode_jwt(no_typ) is None

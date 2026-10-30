"""Caliwo v4 backend tests — Native IAP endpoints + v1/v2/v3 smoke."""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "caliwo.test@example.com"
PASSWORD = "Caliwo#Test2026"
NAME = "Caliwo Tester"

IAP_PRODUCT_ID = "com.caliwo.ainutritioncoach.pro_monthly"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def token():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    if r.status_code != 200:
        r = s.post(f"{API}/auth/register", json={"email": EMAIL, "password": PASSWORD, "name": NAME}, timeout=20)
        assert r.status_code == 200, f"Register/login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_id(token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200
    return r.json()["user_id"]


@pytest.fixture(scope="session")
def mongo_db():
    try:
        c = MongoClient(MONGO_URL, serverSelectionTimeoutMS=500)
        c.admin.command('ping')
        yield c[DB_NAME]
        c.close()
    except Exception:
        class DummyCol:
            def update_one(self, *a, **kw): pass
            def find_one(self, *a, **kw): return None
            def delete_many(self, *a, **kw): pass
            def delete_one(self, *a, **kw): pass
            def insert_one(self, *a, **kw): pass

        class DummyMongo:
            def __getitem__(self, name):
                return DummyCol()
            def __getattr__(self, name):
                return DummyCol()

        yield DummyMongo()


# ---------------- IAP: products endpoint ----------------
class TestIAPProducts:
    def test_products_requires_auth(self):
        r = requests.post(f"{API}/iap/products", timeout=20)
        assert r.status_code == 401, f"Expected 401 without token, got {r.status_code}"

    def test_products_returns_pro_monthly(self, auth_headers):
        r = requests.post(f"{API}/iap/products", headers=auth_headers, timeout=20)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "products" in data
        products = data["products"]
        assert isinstance(products, list) and len(products) >= 1, f"Expected at least one product, got {products}"
        p = products[0]
        assert p["product_id"].endswith(".pro_monthly"), f"product_id={p['product_id']}"
        assert p["tier"] == "pro_monthly"
        assert p["days"] == 30


# ---------------- IAP: verify auth + validation ----------------
class TestIAPVerifyGuards:
    def test_verify_requires_auth(self):
        r = requests.post(
            f"{API}/iap/verify",
            json={"platform": "ios", "product_id": IAP_PRODUCT_ID, "transaction_id": "x"},
            timeout=20,
        )
        assert r.status_code == 401

    def test_verify_wrong_product_id(self, auth_headers):
        r = requests.post(
            f"{API}/iap/verify",
            headers=auth_headers,
            json={"platform": "ios", "product_id": "bogus.product", "transaction_id": "abc"},
            timeout=20,
        )
        assert r.status_code == 400
        assert "Unknown product_id" in r.json().get("detail", "")

    def test_verify_ios_missing_transaction_id(self, auth_headers):
        r = requests.post(
            f"{API}/iap/verify",
            headers=auth_headers,
            json={"platform": "ios", "product_id": IAP_PRODUCT_ID},
            timeout=20,
        )
        assert r.status_code == 400
        assert "Missing transaction_id for iOS" in r.json().get("detail", "")

    def test_verify_android_missing_purchase_token(self, auth_headers):
        r = requests.post(
            f"{API}/iap/verify",
            headers=auth_headers,
            json={"platform": "android", "product_id": IAP_PRODUCT_ID},
            timeout=20,
        )
        assert r.status_code == 400
        assert "Missing purchase_token for Android" in r.json().get("detail", "")


# ---------------- IAP: missing credentials ----------------
class TestIAPMissingCredentials:
    def test_ios_no_credentials(self, auth_headers):
        # Use a UNIQUE transaction id so idempotency doesn't short-circuit
        tid = f"TEST_ios_{uuid.uuid4().hex[:10]}"
        r = requests.post(
            f"{API}/iap/verify",
            headers=auth_headers,
            json={"platform": "ios", "product_id": IAP_PRODUCT_ID, "transaction_id": tid},
            timeout=25,
        )
        assert r.status_code == 500, f"Expected 500, got {r.status_code} {r.text}"
        assert "iOS App Store credentials not configured" in r.json().get("detail", "")

    def test_android_no_service_account(self, auth_headers):
        ptok = f"TEST_and_{uuid.uuid4().hex[:10]}"
        r = requests.post(
            f"{API}/iap/verify",
            headers=auth_headers,
            json={"platform": "android", "product_id": IAP_PRODUCT_ID, "purchase_token": ptok},
            timeout=25,
        )
        assert r.status_code == 500, f"Expected 500, got {r.status_code} {r.text}"
        assert "Google Play service account not configured" in r.json().get("detail", "")


# ---------------- IAP: idempotency ----------------
class TestIAPIdempotency:
    def test_idempotent_fulfilled_receipt(self, auth_headers, user_id, mongo_db):
        if type(mongo_db).__name__ == "DummyMongo":
            pytest.skip("MongoDB process not running locally for legacy fixture")
        # Simulate a fulfilled receipt
        tid = f"TEST_idempo_{uuid.uuid4().hex[:10]}"
        mongo_db.iap_receipts.insert_one({
            "key": tid,
            "user_id": user_id,
            "platform": "ios",
            "product_id": IAP_PRODUCT_ID,
            "status": "fulfilled",
        })
        try:
            r = requests.post(
                f"{API}/iap/verify",
                headers=auth_headers,
                json={"platform": "ios", "product_id": IAP_PRODUCT_ID, "transaction_id": tid},
                timeout=25,
            )
            assert r.status_code == 200, f"Expected 200 already_fulfilled, got {r.status_code} {r.text}"
            data = r.json()
            assert data.get("ok") is True
            assert data.get("already_fulfilled") is True
        finally:
            try:
                mongo_db.iap_receipts.delete_one({"key": tid})
            except Exception:
                pass

    def test_idempotent_android_purchase_token(self, auth_headers, user_id, mongo_db):
        if type(mongo_db).__name__ == "DummyMongo":
            pytest.skip("MongoDB process not running locally for legacy fixture")
        ptok = f"TEST_idempo_and_{uuid.uuid4().hex[:10]}"
        mongo_db.iap_receipts.insert_one({
            "key": ptok,
            "user_id": user_id,
            "platform": "android",
            "product_id": IAP_PRODUCT_ID,
            "status": "fulfilled",
        })
        try:
            r = requests.post(
                f"{API}/iap/verify",
                headers=auth_headers,
                json={"platform": "android", "product_id": IAP_PRODUCT_ID, "purchase_token": ptok},
                timeout=25,
            )
            assert r.status_code == 200
            data = r.json()
            assert data.get("ok") is True
            assert data.get("already_fulfilled") is True
        finally:
            try:
                mongo_db.iap_receipts.delete_one({"key": ptok})
            except Exception:
                pass


# ---------------- v1/v2/v3 smoke ----------------
class TestSmokeV1V2V3:
    def test_auth_me(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("email") == EMAIL

    def test_subscription_status(self, auth_headers):
        r = requests.get(f"{API}/subscription/status", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "is_pro" in data
        assert "price_usd" in data
        assert "days_per_purchase" in data

    def test_family_me(self, auth_headers):
        r = requests.get(f"{API}/family/me", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert "family" in r.json()

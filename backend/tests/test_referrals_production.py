"""
Integration tests for Referral Code Generation, Validation, Redemption & Pro Granting.
"""

import os
import uuid
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_user() -> str:
    email = f"test_ref_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234Word!"}, timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    return r.json()["token"]


class TestReferralSystem:
    def test_referral_full_lifecycle(self):
        # 1. Register User A (Referrer)
        token_a = _fresh_user()
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 2. Get User A's referral code
        res_a = requests.get(f"{API}/referrals/me", headers=headers_a, timeout=10)
        assert res_a.status_code == 200
        data_a = res_a.json()
        code_a = data_a["code"]
        assert len(code_a) >= 4
        assert data_a["commission_rate"] == 0.20
        assert data_a["redemptions"] == 0
        assert data_a["already_redeemed_a_code"] is False

        # 3. User A cannot redeem own code
        res_self = requests.post(
            f"{API}/referrals/redeem",
            json={"code": code_a},
            headers=headers_a,
            timeout=10,
        )
        assert res_self.status_code == 400

        # 4. Register User B (Referee)
        token_b = _fresh_user()
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 5. User B attempts invalid referral code
        res_inv = requests.post(
            f"{API}/referrals/redeem",
            json={"code": "CALIWO-INVALIDCODE123"},
            headers=headers_b,
            timeout=10,
        )
        assert res_inv.status_code == 404

        # 6. User B redeems User A's referral code
        res_redeem = requests.post(
            f"{API}/referrals/redeem",
            json={"code": code_a},
            headers=headers_b,
            timeout=10,
        )
        assert res_redeem.status_code == 200
        redeem_payload = res_redeem.json()
        assert redeem_payload["ok"] is True
        assert redeem_payload["commission_rate"] == 0.20

        # 7. User B tries to redeem again -> 400
        res_duplicate = requests.post(
            f"{API}/referrals/redeem",
            json={"code": code_a},
            headers=headers_b,
            timeout=10,
        )
        assert res_duplicate.status_code == 400

        # 8. Verify Referrer (User A) status shows 1 redemption and $0 earned before purchase
        res_a_after = requests.get(f"{API}/referrals/me", headers=headers_a, timeout=10)
        assert res_a_after.status_code == 200
        data_a_after = res_a_after.json()
        assert data_a_after["redemptions"] == 1
        assert data_a_after["total_commission_earned"] == 0.0

        # 9. User B purchases a subscription via IAP verify ($9.99 monthly)
        res_iap = requests.post(
            f"{API}/iap/verify",
            json={
                "platform": "ios",
                "product_id": "com.caliwo.ainutritioncoach.pro_monthly",
                "transaction_id": f"tx_test_{uuid.uuid4().hex}"
            },
            headers=headers_b,
            timeout=10,
        )
        assert res_iap.status_code == 200

        # 10. Verify Referrer (User A) earned 20% of $9.99 ($2.00)
        res_a_final = requests.get(f"{API}/referrals/me", headers=headers_a, timeout=10)
        assert res_a_final.status_code == 200
        data_a_final = res_a_final.json()
        assert data_a_final["total_commission_earned"] == 2.00
        assert data_a_final["commission_balance"] == 2.00
        assert data_a_final["paid_conversions"] == 1
        assert len(data_a_final["commission_history"]) == 1


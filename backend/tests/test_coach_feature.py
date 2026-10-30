"""Unit & Integration tests for Feature 10 (AI Coach chat & voice).

Covers:
- POST /api/coach/message (Text chat with memory RAG)
- GET /api/coach/history (Session chat history)
- GET /api/coach/suggestions (Coach suggestions)
- GET /api/coach/weekly-insight (Weekly progress insight)
- POST /api/coach/speak (TTS voice endpoint)
"""
import os
import uuid
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_user() -> str:
    email = f"test_coach_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234Word!"}, timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    return r.json()["token"]


class TestAICoachFeature:
    def test_coach_chat_flow(self):
        token = _fresh_user()
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Send message
        msg_res = requests.post(
            f"{API}/coach/message",
            headers=headers,
            json={"message": "What is a good high-protein snack for weight loss?"},
            timeout=10
        )
        assert msg_res.status_code == 200
        reply = msg_res.json()
        assert "reply" in reply and "session_id" in reply
        session_id = reply["session_id"]

        # 2. Get chat history
        hist_res = requests.get(f"{API}/coach/history?session_id={session_id}", headers=headers, timeout=10)
        assert hist_res.status_code == 200
        messages = hist_res.json()["messages"]
        assert len(messages) >= 2
        assert any(m["role"] == "user" for m in messages)
        assert any(m["role"] == "assistant" for m in messages)

        # 3. Get suggestions
        sug_res = requests.get(f"{API}/coach/suggestions", headers=headers, timeout=10)
        assert sug_res.status_code == 200
        assert "suggestions" in sug_res.json()

        # 4. Get weekly insight
        ins_res = requests.get(f"{API}/coach/weekly-insight", headers=headers, timeout=10)
        assert ins_res.status_code == 200
        assert "insight" in ins_res.json()

        # 5. TTS speak
        speak_res = requests.post(
            f"{API}/coach/speak",
            headers=headers,
            json={"text": "Here is your personalized nutrition tip.", "voice": "shimmer"},
            timeout=10
        )
        assert speak_res.status_code == 200
        assert speak_res.headers.get("content-type") == "audio/mpeg"
        assert len(speak_res.content) > 0


if __name__ == "__main__":
    t = TestAICoachFeature()
    print("Running test_coach_chat_flow...")
    t.test_coach_chat_flow()
    print("ALL AI COACH TESTS PASSED SUCCESSFULLY!")

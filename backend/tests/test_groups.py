import pytest
from starlette.testclient import TestClient
from server import app

@pytest.fixture
def client():
    return TestClient(app)

def test_create_and_discover_groups(client):
    # 1. Register test user
    reg_res = client.post(
        "/api/auth/register",
        json={"email": "group_tester@nutri.ai", "password": "password123", "name": "GroupTester"}
    )
    if reg_res.status_code != 200:
        login_res = client.post(
            "/api/auth/login",
            json={"email": "group_tester@nutri.ai", "password": "password123"}
        )
        token = login_res.json()["token"]
    else:
        token = reg_res.json()["token"]

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create a group
    create_res = client.post(
        "/api/groups",
        headers=headers,
        json={
            "name": "Test Fitness Community",
            "description": "A group dedicated to testing and fitness streaks.",
            "category": "Gym",
            "privacy": "public",
            "rules": ["Be supportive", "Log daily workouts"]
        }
    )
    assert create_res.status_code == 200
    data = create_res.json()
    assert data["ok"] is True
    group_id = data["group_id"]

    # 3. Discover groups
    disc_res = client.get("/api/groups/discover?tab=new", headers=headers)
    assert disc_res.status_code == 200
    disc_data = disc_res.json()
    assert "groups" in disc_data
    assert any(g["id"] == group_id for g in disc_data["groups"])

    # 4. Get group details
    details_res = client.get(f"/api/groups/{group_id}", headers=headers)
    assert details_res.status_code == 200
    details = details_res.json()
    assert details["name"] == "Test Fitness Community"
    assert details["user_role"] == "owner"

    # 5. Get My Groups
    my_res = client.get("/api/groups/my", headers=headers)
    assert my_res.status_code == 200
    my_data = my_res.json()
    assert any(g["id"] == group_id for g in my_data["groups"])

    # 6. Send chat message
    msg_res = client.post(
        f"/api/groups/{group_id}/messages",
        headers=headers,
        json={"content": "Hello fitness crew! Ready for today's workout?"}
    )
    assert msg_res.status_code == 200
    msg_data = msg_res.json()
    assert msg_data["ok"] is True
    msg_id = msg_data["message"]["id"]

    # 7. Fetch chat messages
    chat_res = client.get(f"/api/groups/{group_id}/messages", headers=headers)
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert len(chat_data["messages"]) >= 1

    # 8. React to message
    rx_res = client.post(
        f"/api/groups/{group_id}/messages/{msg_id}/react",
        headers=headers,
        json={"emoji": "🔥"}
    )
    assert rx_res.status_code == 200

    # 9. Fetch Leaderboard
    lb_res = client.get(f"/api/groups/{group_id}/leaderboard", headers=headers)
    assert lb_res.status_code == 200
    lb_data = lb_res.json()
    assert "leaderboard" in lb_data

    # 10. Fetch Members
    mem_res = client.get(f"/api/groups/{group_id}/members", headers=headers)
    assert mem_res.status_code == 200
    mem_data = mem_res.json()
    assert len(mem_data["members"]) >= 1

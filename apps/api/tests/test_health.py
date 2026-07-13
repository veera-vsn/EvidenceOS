"""Smoke test for `/health`.

We use FastAPI's `TestClient` which spins up the app in-process — no
network sockets, no separate uvicorn. Perfect for CI.
"""

from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok() -> None:
    """The health endpoint must return 200 with the expected shape."""
    client = TestClient(create_app())
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "env" in body
    assert "version" in body
    assert "timestamp" in body

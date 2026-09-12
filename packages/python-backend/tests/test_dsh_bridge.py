"""Fail-closed guarantees for the dsh tool bridge (T00.2).

The bridge must refuse every call while no explicit secret is configured,
reject wrong secrets, and never execute tools on behalf of a caller-supplied
user id without a valid secret.
"""

from fastapi.testclient import TestClient


class TestBridgeFailClosed:
    def test_unconfigured_bridge_returns_503(self, client: TestClient, api_prefix: str, monkeypatch):
        import app.api.v1.dsh as dsh_module

        monkeypatch.setattr(dsh_module.settings, "dsh_bridge_secret", "")
        response = client.post(
            f"{api_prefix}/dsh/tools/execute",
            json={"tool": "web_search", "args": {}},
            headers={"X-Bridge-Secret": "anything"},
        )
        assert response.status_code == 503

    def test_wrong_secret_rejected(self, client: TestClient, api_prefix: str, monkeypatch):
        import app.api.v1.dsh as dsh_module

        monkeypatch.setattr(dsh_module.settings, "dsh_bridge_secret", "test-secret")
        response = client.post(
            f"{api_prefix}/dsh/tools/execute",
            json={"tool": "web_search", "args": {}},
            headers={"X-Bridge-Secret": "wrong-secret"},
        )
        assert response.status_code == 401

    def test_unknown_tool_returns_error_payload(self, client: TestClient, api_prefix: str, monkeypatch):
        import app.api.v1.dsh as dsh_module

        monkeypatch.setattr(dsh_module.settings, "dsh_bridge_secret", "test-secret")
        response = client.post(
            f"{api_prefix}/dsh/tools/execute",
            json={"tool": "no_such_tool", "args": {}},
            headers={"X-Bridge-Secret": "test-secret"},
        )
        assert response.status_code == 200
        assert "error" in response.json()["result"]

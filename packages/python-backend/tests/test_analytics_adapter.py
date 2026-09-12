"""T100 — analytics adapter: machine auth headers and authoritative routing."""

import pytest

from app.core.machine import machine_headers
from app.services.analytics.nuxt import local_db_allowed


class TestMachineHeaders:
    def test_header_shape(self):
        headers = machine_headers("secret", b'{"a":1}')
        assert set(headers) == {"X-Machine-Timestamp", "X-Machine-Signature"}
        assert len(headers["X-Machine-Signature"]) == 64

    def test_local_db_fallback_off_by_default(self, monkeypatch):
        monkeypatch.delenv("ANALYTICS_LOCAL_DB", raising=False)
        assert local_db_allowed() is False


class TestAnalyticsToolsRouting:
    @pytest.mark.asyncio
    async def test_best_posts_requires_business(self):
        from app.services.tools.manager import ToolManager

        manager = ToolManager("user-1")
        result = await manager._execute_best_posts({"days": 7})
        assert "error" in result
        assert "business_id" in result["error"]

    @pytest.mark.asyncio
    async def test_best_posts_calls_internal_api(self, monkeypatch):
        from app.services.analytics import nuxt as adapter
        from app.services.tools.manager import ToolManager

        calls = {}

        async def spy(settings, path, payload):
            calls["path"] = path
            calls.update(payload)
            return {"posts": [{"postId": "p1"}], "warnings": [], "version": "analytics/v1"}

        monkeypatch.setattr(adapter, "call_internal_analytics", spy)

        manager = ToolManager("user-1")
        result = await manager._execute_best_posts({"business_id": "biz-1", "days": 7})
        assert result["source"] == "authoritative"
        assert result["count"] == 1
        assert calls["path"] == "/api/v1/internal/analytics/best-posts"
        assert calls["businessId"] == "biz-1"

    @pytest.mark.asyncio
    async def test_virality_draft_never_fabricates(self):
        from app.services.tools.manager import ToolManager

        manager = ToolManager("user-1")
        result = await manager._execute_virality_check({"content": "hello world, this is long enough"})
        assert result["score"] is None
        assert "reason" in result

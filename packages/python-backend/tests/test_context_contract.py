"""T20.2 — shared business-context request contract (Nuxt/Python parity).

Every MagicSync-managed AI entry point carries business_id,
use_business_context, and context_edition_id alongside the grounded prompt.
"""

from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.schemas.chat import ChatRequest
from app.schemas.social_media import (
    GeneratePostRequest,
    GenerateBatchRequest,
    GenerateThreadRequest,
    GenerateVariationsRequest,
    GenerateHooksRequest,
    GenerateHashtagsRequest,
    GenerateBulkTemplateRequest,
)


class TestContextContract:
    def test_chat_request_defaults_ungrounded(self):
        req = ChatRequest(messages=[{"role": "user", "content": "hi"}])
        assert req.business_id is None
        assert req.use_business_context is False
        assert req.context_edition_id is None
        assert req.business_context is None

    def test_chat_request_accepts_grounded_contract(self):
        req = ChatRequest(
            messages=[],
            business_id="biz-1",
            use_business_context=True,
            context_edition_id="ed-1",
            business_context="## voice_guide\nBold",
        )
        assert req.business_id == "biz-1"
        assert req.context_edition_id == "ed-1"

    def test_social_requests_share_the_contract(self):
        cases = [
            GeneratePostRequest(topic="t", platform="twitter"),
            GenerateBatchRequest(topic="t", platforms=["twitter"]),
            GenerateThreadRequest(topic="t"),
            GenerateVariationsRequest(base_content="c", platform="twitter"),
            GenerateHooksRequest(topic="t", platform="twitter"),
            GenerateHashtagsRequest(topic="t", platform="twitter"),
            GenerateBulkTemplateRequest(topic="t", platforms=["twitter"]),
        ]
        for req in cases:
            assert req.business_id is None, type(req).__name__
            assert req.use_business_context is False, type(req).__name__
            assert req.context_edition_id is None, type(req).__name__

        grounded = GeneratePostRequest(
            topic="t",
            platform="twitter",
            business_id="biz-1",
            use_business_context=True,
            context_edition_id="ed-9",
        )
        assert grounded.business_id == "biz-1"
        assert grounded.use_business_context is True
        assert grounded.context_edition_id == "ed-9"


class TestSocialGrounding:
    def test_generate_prepends_brand_context(self, client: TestClient, api_prefix: str, test_headers: dict):
        seen = {}

        async def fake_generate_post(**kwargs):
            seen.update(kwargs)
            return {"text": "hello", "hashtags": [], "platform": "twitter", "character_count": 5}

        with patch(
            "app.api.v1.social_media.get_social_media_generator",
            return_value=type("Gen", (), {"generate_post": staticmethod(fake_generate_post)})(),
        ):
            response = client.post(
                f"{api_prefix}/social-media/generate",
                json={
                    "topic": "launch day",
                    "platform": "twitter",
                    "business_id": "biz-1",
                    "use_business_context": True,
                    "context_edition_id": "ed-7",
                    "business_context": "## voice_guide\nBold",
                },
                headers=test_headers,
            )
            assert response.status_code == 200
            assert "Bold" in seen["additional_context"]
            assert seen["topic"] == "launch day"

    def test_hooks_ground_topic_without_context(self, client: TestClient, api_prefix: str, test_headers: dict):
        seen = {}

        async def fake_generate_hooks(**kwargs):
            seen.update(kwargs)
            return {"hooks": [], "count": 0}

        with patch(
            "app.api.v1.social_media.get_social_media_generator",
            return_value=type("Gen", (), {"generate_hooks": staticmethod(fake_generate_hooks)})(),
        ):
            response = client.post(
                f"{api_prefix}/social-media/generate-hooks",
                json={"topic": "launch day", "platform": "twitter", "count": 3},
                headers=test_headers,
            )
            assert response.status_code == 200
            assert seen["topic"] == "launch day"

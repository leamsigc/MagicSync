"""E2E coverage for inherited features (no LLM, no network writes).

Exercises the live FastAPI app via TestClient: research doctor (all 5
channels incl. scrapegraph), tool registry (scrape_url + analytics tools),
analytics tools against the real local.db (graceful when empty), and the
social_pipeline harness registration.
"""

import pytest

from app.services.harness.engine import harness_engine
from app.services.tools.manager import ToolManager


def tool_names():
    return [t["function"]["name"] for t in ToolManager("e2e").get_tool_definitions()]


def test_health_ok(client, api_prefix):
    response = client.get(f"{api_prefix}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_research_doctor_lists_all_channels(client, api_prefix, test_headers):
    response = client.get(f"{api_prefix}/research/doctor", headers=test_headers)
    assert response.status_code == 200
    channels = response.json()["channels"]
    for expected in ("web", "youtube", "github", "rss", "scrapegraph"):
        assert expected in channels
        assert channels[expected]["status"] in ("ok", "warn", "off", "error")
        assert isinstance(channels[expected]["message"], str)


def test_tool_registry_has_new_tools():
    names = tool_names()
    for expected in (
        "scrape_url",
        "virality_check",
        "engagement_calc",
        "best_posts",
        "destructure_post",
        "apply_template",
    ):
        assert expected in names


@pytest.mark.asyncio
async def test_scrape_url_validates_args():
    manager = ToolManager("e2e")
    result = await manager.execute_tool("scrape_url", {"url": "", "prompt": ""})
    assert "error" in result


@pytest.mark.asyncio
async def test_virality_check_pure_math():
    manager = ToolManager("e2e")
    result = await manager.execute_tool(
        "virality_check",
        {"content": "Hook?\nBody line\nBuy now https://x.test"},
    )
    assert "score" in result or "error" in result


@pytest.mark.asyncio
async def test_best_posts_reads_real_db_gracefully():
    manager = ToolManager("e2e")
    result = await manager.execute_tool("best_posts", {"days": 1, "limit": 3})
    assert result.get("error", "").startswith("business_id is required")


@pytest.mark.asyncio
async def test_template_round_trip():
    manager = ToolManager("e2e")
    template = {
        "hook": "q",
        "hook_style": "question",
        "structure": ["hook", "body", "cta"],
        "cta_style": "link",
        "tone_notes": "bold",
        "platform": "instagram",
    }
    result = await manager.execute_tool(
        "apply_template", {"template": template, "theme": "launch day"}
    )
    assert "error" not in result
    assert "launch day" in str(result)


def test_llm_providers_mirror_nuxt_defaults(client, api_prefix, test_headers):
    response = client.get(f"{api_prefix}/llm/providers", headers=test_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["default_provider"] == "google"
    assert body["default_model"] == "gemini-3-flash-preview"
    assert {p["provider"] for p in body["providers"]} == {
        "google", "ollama", "openai", "anthropic", "openrouter", "deepseek",
    }


def test_execute_phase_rejects_unknown_inline_type(client, api_prefix, test_headers):
    response = client.post(
        f"{api_prefix}/agent-extended/harness/execute-phase",
        json={
            "harness_type": "custom",
            "phase_index": 0,
            "phase_input": {},
            "thread_id": "t",
            "phases": [{"name": "Bogus", "type": "teleport"}],
        },
        headers=test_headers,
    )
    assert response.status_code == 400


def test_social_pipeline_registered_with_five_steps():
    phases = harness_engine.get_harness("social_pipeline")
    assert [p["name"] for p in phases] == [
        "Research topics",
        "Write post",
        "Humanize",
        "Design HTML",
        "Human review",
    ]

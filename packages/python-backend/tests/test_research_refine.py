"""Tests for questionnaire → playbook refinement (no LLM needed)."""

import pytest

from app.services.research import refine


def test_build_prompt_includes_answers_and_shape():
    prompt = refine.build_refine_prompt(
        [{"section": "voice", "question": "How do you sound?", "answer": "Bold"}],
        draft={"voice": {"tone": "Old"}},
        business_context="Acme",
    )
    assert "Bold" in prompt
    assert "businessName" in prompt
    assert "Old" in prompt
    assert "Acme" in prompt


def test_build_prompt_skips_empty_answers():
    prompt = refine.build_refine_prompt(
        [{"section": "voice", "question": "Q?", "answer": "   "}],
    )
    assert "Q?" not in prompt


def test_parse_valid_json():
    assert refine.parse_playbook_json('{"a": 1}') == {"a": 1}


def test_parse_strips_code_fences():
    assert refine.parse_playbook_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_parse_rejects_garbage():
    assert refine.parse_playbook_json("not json") is None
    assert refine.parse_playbook_json("[1, 2]") is None


@pytest.mark.asyncio
async def test_refine_rejects_empty_answers():
    result = await refine.refine_answers([])
    assert "error" in result


@pytest.mark.asyncio
async def test_refine_returns_playbook(monkeypatch):
    from app.services import llm as llm_module

    async def fake_chat_text(self, messages, **kwargs):
        return '{"businessName": "Acme", "version": 1}'

    monkeypatch.setattr(llm_module.LLMService, "chat_text", fake_chat_text)
    result = await refine.refine_answers(
        [{"section": "general", "question": "Name?", "answer": "Acme"}]
    )
    assert result["playbook"]["businessName"] == "Acme"


def test_has_credentials_ollama_needs_no_key():
    assert refine.has_credentials("ollama", None) is True


def test_has_credentials_missing_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert refine.has_credentials("google", None) is False
    assert refine.has_credentials("google", "sk-x") is True


@pytest.mark.asyncio
async def test_refine_blocks_without_credentials(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    result = await refine.refine_answers(
        [{"section": "general", "question": "Q?", "answer": "A"}],
        provider="google",
    )
    assert "error" in result
    assert "AI_AUTH_FAILED" in result["error"]


def test_refine_endpoint_validates_empty(client, api_prefix, test_headers):
    response = client.post(
        f"{api_prefix}/research/refine-playbook",
        json={"answers": []},
        headers=test_headers,
    )
    assert response.status_code == 400

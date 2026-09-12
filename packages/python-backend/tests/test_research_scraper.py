"""Tests for ScrapeGraphAI scraper module (no network, no LLM)."""

import pytest

from app.services.research import scraper
from app.services.research.channels import get_all_channels


def test_build_llm_config_ollama_default():
    config = scraper.build_llm_config()
    assert config["model"] == "ollama/qwen3.5"
    assert "api_key" not in config


def test_build_llm_config_openai_with_key():
    config = scraper.build_llm_config("openai", "gpt-4o-mini", api_key="sk-x")
    assert config["model"] == "openai/gpt-4o-mini"
    assert config["api_key"] == "sk-x"


def test_build_llm_config_custom_base():
    config = scraper.build_llm_config("ollama", "llama3.2", api_base="http://x:11434")
    assert config["base_url"] == "http://x:11434"


@pytest.mark.asyncio
async def test_run_smartscraper_reports_when_missing(monkeypatch):
    monkeypatch.setattr(scraper, "is_smartscraper_available", lambda: False)
    result = await scraper.run_smartscraper("https://example.com", "p", "ollama", "m", None, None)
    assert result["backend"] == "smartscraper"
    assert "error" in result


@pytest.mark.asyncio
async def test_extract_falls_back_to_jina(monkeypatch):
    monkeypatch.setattr(scraper, "is_smartscraper_available", lambda: False)
    monkeypatch.setattr(scraper, "is_markdownify_available", lambda: False)

    async def fake_read(self, url):
        return "# hello"

    from app.services.research.channels.web import WebChannel

    monkeypatch.setattr(WebChannel, "read", fake_read)
    result = await scraper.extract("https://example.com", "summarize")
    assert result["backend"] == "jina-reader"
    assert "hello" in str(result["result"])


@pytest.mark.asyncio
async def test_extract_never_raises(monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("nope")

    monkeypatch.setattr(scraper, "run_smartscraper", boom)
    monkeypatch.setattr(scraper, "run_markdownify", boom)
    monkeypatch.setattr(scraper, "run_jina_fallback", boom)
    result = await scraper.extract("https://example.com", "x")
    assert result["backend"] == "none"
    assert "nope" in result["error"]


def test_scrapegraph_channel_registered():
    names = [c.name for c in get_all_channels()]
    assert "scrapegraph" in names


def test_all_channel_checks_never_raise():
    for channel in get_all_channels():
        status, message = channel.check({})
        assert status in ("ok", "warn", "off", "error")
        assert isinstance(message, str)

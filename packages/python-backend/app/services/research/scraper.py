"""Structured web extraction via ScrapeGraphAI with graceful fallbacks.

Ordered backends: SmartScraperGraph (LLM extraction) -> MarkdownifyGraph
(no LLM, clean markdown) -> jina-reader web channel (no deps). Never raises;
callers always get a dict with `backend` + `result` or `error`.
"""

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

PROVIDER_MODEL_PREFIX = {
    "ollama": "ollama",
    "openai": "openai",
    "anthropic": "anthropic",
    "groq": "groq",
    "gemini": "google_genai",
    "azure": "azure",
}


def build_llm_config(
    provider: str = "ollama",
    model: str = "qwen3.5",
    api_key: str | None = None,
    api_base: str | None = None,
) -> dict:
    """Map our provider/model to a ScrapeGraphAI llm config dict."""
    prefix = PROVIDER_MODEL_PREFIX.get(provider, provider)
    config: dict = {"model": f"{prefix}/{model}", "temperature": 0}
    if api_key:
        config["api_key"] = api_key
    if api_base:
        config["base_url"] = api_base
    return config


def is_smartscraper_available() -> bool:
    try:
        from scrapegraphai.graphs import SmartScraperGraph  # noqa: F401

        return True
    except ImportError:
        return False


def is_markdownify_available() -> bool:
    try:
        from scrapegraphai.graphs import MarkdownifyGraph  # noqa: F401

        return True
    except ImportError:
        return False


def has_llm_configured(provider: str = "ollama") -> bool:
    if provider == "ollama":
        return True  # probed live at extract time; local daemon may exist
    env_keys = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "groq": "GROQ_API_KEY",
        "gemini": "GEMINI_API_KEY",
    }
    key = env_keys.get(provider)
    return bool(key and os.environ.get(key))


async def extract(
    url: str,
    prompt: str,
    provider: str = "ollama",
    model: str = "qwen3.5",
    api_key: str | None = None,
    api_base: str | None = None,
    timeout_seconds: int = 90,
) -> dict:
    """Extract structured data from a URL. Falls back down the backend chain."""
    from app.services.research.ssrf import SSRFError, validate_url

    try:
        safe_url = validate_url(url)
    except SSRFError as exc:
        return {"backend": "none", "error": f"Blocked URL: {exc}"}
    try:
        smart = await asyncio.wait_for(
            run_smartscraper(safe_url, prompt, provider, model, api_key, api_base),
            timeout=timeout_seconds,
        )
        if "result" in smart:
            return smart
        logger.info(f"SmartScraper failed, trying markdownify: {smart.get('error')}")
        markdown = await asyncio.wait_for(run_markdownify(safe_url), timeout=timeout_seconds)
        if "result" in markdown:
            return markdown
        logger.info("Markdownify failed, falling back to jina-reader")
        return await run_jina_fallback(safe_url)
    except (asyncio.TimeoutError, Exception) as exc:
        logger.error(f"scraper.extract failed: {exc}")
        return {"backend": "none", "error": str(exc)}


async def run_smartscraper(
    url: str,
    prompt: str,
    provider: str,
    model: str,
    api_key: str | None,
    api_base: str | None,
) -> dict:
    if not is_smartscraper_available():
        return {"backend": "smartscraper", "error": "scrapegraphai not installed"}
    try:
        from scrapegraphai.graphs import SmartScraperGraph

        graph_config = {
            "llm": build_llm_config(provider, model, api_key, api_base),
            "verbose": False,
            "headless": True,
        }

        def _run() -> dict:
            graph = SmartScraperGraph(prompt=prompt, source=url, config=graph_config)
            return graph.run()

        result = await asyncio.to_thread(_run)
        return {"backend": "smartscraper", "result": result}
    except Exception as exc:
        return {"backend": "smartscraper", "error": str(exc)}


async def run_markdownify(url: str) -> dict:
    if not is_markdownify_available():
        return {"backend": "markdownify", "error": "scrapegraphai not installed"}
    try:
        from scrapegraphai.graphs import MarkdownifyGraph

        def _run() -> dict:
            graph = MarkdownifyGraph(source=url, config={"verbose": False})
            return graph.run()

        result = await asyncio.to_thread(_run)
        return {"backend": "markdownify", "result": result}
    except Exception as exc:
        return {"backend": "markdownify", "error": str(exc)}


async def run_jina_fallback(url: str) -> dict:
    try:
        from app.services.research.channels.web import WebChannel

        text = await WebChannel().read(url)
        return {"backend": "jina-reader", "result": {"markdown": text}}
    except Exception as exc:
        return {"backend": "jina-reader", "error": str(exc)}

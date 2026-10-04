"""Tool implementations exposed by the MagicSync Python tools service."""

from __future__ import annotations

import os
from typing import Any, Awaitable, Callable

import httpx
from starlette.concurrency import run_in_threadpool


class ToolUnavailable(RuntimeError):
    """Raised when a tool's optional dependency is not installed."""


ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


def _require_scrapegraphai() -> None:
    try:
        import scrapegraphai  # noqa: F401
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ToolUnavailable(
            "scrapegraphai is not installed. Run: pip install -r requirements-scrapegraph.txt"
        ) from exc


def _llm_config() -> dict[str, Any]:
    model = os.environ.get("SCRAPEGRAPH_MODEL", "openai/gpt-4o-mini")
    config: dict[str, Any] = {"llm": {"model": model, "temperature": 0.1}}
    if os.environ.get("SCRAPEGRAPH_BASE_URL"):
        config["llm"]["base_url"] = os.environ["SCRAPEGRAPH_BASE_URL"]
    return config


async def fetch_text(args: dict[str, Any]) -> dict[str, Any]:
    """Fetch a URL and return its readable text (SSRF-safe in the caller)."""
    url = str(args.get("url", "")).strip()
    if not url:
        raise ValueError("url is required")
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(url, headers={"user-agent": "MagicSyncBot/1.0"})
        response.raise_for_status()
        return {"url": url, "status": response.status_code, "text": response.text[:50_000]}


async def scrapegraph_smartscraper(args: dict[str, Any]) -> dict[str, Any]:
    """Run ScrapeGraphAI SmartScraperGraph over a URL or local HTML file."""
    _require_scrapegraphai()
    from scrapegraphai.graphs import SmartScraperGraph

    prompt = str(args.get("prompt", "")).strip()
    source = str(args.get("url") or args.get("source", "")).strip()
    if not prompt or not source:
        raise ValueError("prompt and url are required")

    def run() -> Any:
        graph = SmartScraperGraph(prompt=prompt, source=source, config=_llm_config())
        return graph.run()

    result = await run_in_threadpool(run)
    return {"source": source, "prompt": prompt, "result": result}


async def scrapegraph_searchscraper(args: dict[str, Any]) -> dict[str, Any]:
    """Run ScrapeGraphAI SearchGraph over a web query."""
    _require_scrapegraphai()
    from scrapegraphai.graphs import SearchGraph

    prompt = str(args.get("query") or args.get("prompt", "")).strip()
    if not prompt:
        raise ValueError("query is required")
    max_results = int(args.get("max_results", 5))

    def run() -> Any:
        graph = SearchGraph(
            prompt=prompt,
            config={**_llm_config(), "max_results": max_results},
        )
        return graph.run()

    result = await run_in_threadpool(run)
    return {"query": prompt, "result": result}


TOOLS: list[dict[str, Any]] = [
    {
        "name": "fetch_text",
        "description": "Fetch a public URL and return its raw text (no JS rendering).",
        "args": {"url": "string"},
    },
    {
        "name": "scrapegraph_smartscraper",
        "description": "ScrapeGraphAI SmartScraperGraph: extract structured data from a URL with a prompt.",
        "args": {"prompt": "string", "url": "string"},
    },
    {
        "name": "scrapegraph_searchscraper",
        "description": "ScrapeGraphAI SearchGraph: research a query across the web.",
        "args": {"query": "string", "max_results": "number?"},
    },
]

TOOL_HANDLERS: dict[str, ToolHandler] = {
    "fetch_text": fetch_text,
    "scrapegraph_smartscraper": scrapegraph_smartscraper,
    "scrapegraph_searchscraper": scrapegraph_searchscraper,
}

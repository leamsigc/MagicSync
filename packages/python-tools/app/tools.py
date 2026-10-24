"""Tool implementations exposed by the MagicSync Python tools service."""

from __future__ import annotations

import ipaddress
import os
import socket
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse

import httpx
from starlette.concurrency import run_in_threadpool

MAX_FETCH_BYTES = 2 * 1024 * 1024
MAX_TEXT_CHARS = 50_000

_BLOCKED_HOSTS = {
    "localhost",
    "metadata",
    "metadata.google.internal",
    "kubernetes.default",
}


class ToolUnavailable(RuntimeError):
    """Raised when a tool's optional dependency is not installed."""


ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


def _assert_public_url(url: str) -> str:
    """Reject anything that is not an http(s) URL resolving to a public address.

    This is defence in depth: the Nuxt caller already validates and pins the
    address, but the sidecar must not become an SSRF proxy if it is ever called
    directly.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("url must be http(s)")
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host or host in _BLOCKED_HOSTS or host.endswith(".local") or host.endswith(".internal"):
        raise ValueError("url host is not allowed")
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError as exc:
        raise ValueError("url host could not be resolved") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError("url host is not allowed")
    return url


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
    """Fetch a public URL and return its readable text."""
    url = _assert_public_url(str(args.get("url", "")).strip())
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        async with client.stream("GET", url, headers={"user-agent": "MagicSyncBot/1.0"}) as response:
            response.raise_for_status()
            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > MAX_FETCH_BYTES:
                    raise ValueError("response exceeded the size limit")
                chunks.append(chunk)
            text = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
    return {"url": url, "status": response.status_code, "text": text[:MAX_TEXT_CHARS]}


async def scrapegraph_smartscraper(args: dict[str, Any]) -> dict[str, Any]:
    """Run ScrapeGraphAI SmartScraperGraph over a public URL."""
    _require_scrapegraphai()
    from scrapegraphai.graphs import SmartScraperGraph

    prompt = str(args.get("prompt", "")).strip()
    source = _assert_public_url(str(args.get("url") or args.get("source", "")).strip())
    if not prompt:
        raise ValueError("prompt is required")

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

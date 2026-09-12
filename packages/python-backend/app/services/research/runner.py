"""Bounded research runs over KB, uploads, and approved URLs (T50).

Combines the user brief, business context (resolved Nuxt-side), RAG
documents, and SSRF-guarded web extraction into a typed ResearchResponse.
External content is isolated as UNTRUSTED source data; failures produce
structured warnings and never crash the run.
"""

import asyncio
import logging
import uuid

from app.schemas.research import ResearchRequest, ResearchResponse
from app.services.research import scraper
from app.services.research.provenance import (
    build_source,
    separate_research_output,
    utcnow_iso,
    wrap_source,
)
from app.services.research.ssrf import SSRFError, validate_url

logger = logging.getLogger(__name__)

EXTRACTION_TIMEOUT_SECONDS = 90
MAX_SOURCE_CHARS = 12_000


def _keywords(brief: str, limit: int = 6) -> list:
    """Deterministic keyword fallback for KB grep (no model call)."""
    stop = {
        "the", "a", "an", "and", "or", "for", "with", "from", "that",
        "this", "find", "best", "what", "how", "why", "our", "your",
    }
    words = [word.strip(".,!?;:()[]{}\"'").lower() for word in brief.split()]
    picked = [word for word in words if len(word) > 3 and word not in stop]
    return picked[:limit]


async def _read_reference_docs(user_id: str, doc_ids: list) -> tuple:
    """Read user-scoped reference documents. Returns (texts, sources, warnings)."""
    from app.services.tools.knowledge_base import KnowledgeBaseTools

    kb = KnowledgeBaseTools(user_id)
    texts: list = []
    sources: list = []
    warnings: list = []
    for doc_id in doc_ids:
        try:
            result = await kb.kb_read(doc_id)
            if result.get("error") or not result.get("document"):
                warnings.append(f"Reference document unavailable: {doc_id}")
                continue
            content = str(result.get("content", ""))[:MAX_SOURCE_CHARS]
            source = build_source(
                kind="document",
                uri=f"doc:{doc_id}",
                title=str(result["document"].get("original_name", doc_id)),
                text=content,
                backend="kb_read",
            )
            sources.append(source)
            texts.append(wrap_source(source["id"], content))
        except Exception as exc:
            warnings.append(f"Reference document failed {doc_id}: {exc}")
    return texts, sources, warnings


async def _extract_url(url: str, brief: str, llm: dict) -> tuple:
    """SSRF-guarded extraction of one URL. Returns (text, source, warning)."""
    try:
        safe_url = validate_url(url)
    except SSRFError as exc:
        return "", None, f"Blocked URL {url}: {exc}"
    try:
        result = await asyncio.wait_for(
            scraper.extract(
                safe_url,
                f"Extract facts relevant to: {brief}",
                provider=llm.get("provider", "ollama"),
                model=llm.get("model", "qwen3.5"),
                api_key=llm.get("api_key"),
                api_base=llm.get("api_base"),
            ),
            timeout=EXTRACTION_TIMEOUT_SECONDS,
        )
    except (asyncio.TimeoutError, Exception) as exc:
        return "", None, f"Extraction failed for {safe_url}: {exc}"
    if "result" not in result:
        return "", None, f"Extraction failed for {safe_url}: {result.get('error', 'unknown')}"
    payload = result["result"]
    text = str(payload.get("markdown", payload))[:MAX_SOURCE_CHARS]
    source = build_source(
        kind="url",
        uri=url,
        final_url=safe_url,
        title=str(payload.get("title", "")),
        text=text,
        backend=str(result.get("backend", "")),
    )
    return wrap_source(source["id"], text), source, ""


async def run_research(request: ResearchRequest, user_id: str, llm: dict) -> ResearchResponse:
    """Execute a bounded research run and return a typed result."""
    research_id = f"res-{uuid.uuid4().hex[:12]}"
    warnings: list = []
    source_texts: list = []
    sources: list = []

    doc_ids = request.reference_document_ids[: request.max_sources]
    if len(request.reference_document_ids) > request.max_sources:
        warnings.append("Reference document list truncated to max_sources")
    doc_texts, doc_sources, doc_warnings = await _read_reference_docs(user_id, doc_ids)
    source_texts.extend(doc_texts)
    sources.extend(doc_sources)
    warnings.extend(doc_warnings)

    remaining = max(request.max_sources - len(sources), 0)
    urls = request.reference_urls[:remaining]
    if len(request.reference_urls) > remaining:
        warnings.append("Reference URL list truncated to max_sources")
    for url in urls:
        text, source, warning = await _extract_url(url, request.brief, llm)
        if warning:
            warnings.append(warning)
            continue
        if source:
            sources.append(source)
        if text:
            source_texts.append(text)

    observations = [f"Brief: {request.brief}"]
    if request.business_context and request.use_business_context:
        observations.append("Brand context applied (current edition only).")
    separated = separate_research_output(source_texts, observations, [], [])
    return ResearchResponse(
        researchId=research_id,
        summary=f"Collected {len(sources)} source(s) for: {request.brief[:120]}",
        topicCandidates=[],
        sources=[
            {
                "id": source["id"],
                "kind": source["kind"],
                "uri": source["uri"],
                "title": source.get("title", ""),
                "retrievedAt": source.get("retrievedAt", utcnow_iso()),
                "contentHash": source.get("contentHash", ""),
            }
            for source in sources
        ],
        claims=separated["claims"],
        warnings=warnings,
    )

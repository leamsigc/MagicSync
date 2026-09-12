"""Authoritative analytics adapter (T100).

Nuxt/Turso is authoritative for metrics, ownership, and business scope.
These helpers call the machine-authenticated internal analytics API.
Direct local SQLite reads are a development fallback only, enabled via
ANALYTICS_LOCAL_DB=1 — production tools must go through this adapter.
"""

import logging
import os

import httpx

from app.core.machine import machine_headers

logger = logging.getLogger(__name__)


def local_db_allowed() -> bool:
    """Whether the legacy local-DB fallback is enabled (development only)."""
    return os.environ.get("ANALYTICS_LOCAL_DB", "") == "1"


def nuxt_base_url(settings) -> str:
    """Base URL for internal Nuxt callbacks."""
    return getattr(settings, "nuxt_internal_url", None) or settings.better_auth_url


async def call_internal_analytics(settings, path: str, payload: dict) -> dict:
    """POST to a Nuxt internal analytics route with machine auth."""
    import json

    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    secret = getattr(settings, "dsh_bridge_secret", "")
    if secret:
        headers.update(machine_headers(secret, body))
    url = nuxt_base_url(settings).rstrip("/") + path
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, content=body, headers=headers)
    except Exception as exc:
        raise RuntimeError(f"Analytics backend unreachable: {exc}") from exc
    if response.status_code == 401:
        raise RuntimeError("Analytics backend rejected machine auth")
    if response.status_code == 403:
        raise RuntimeError("Business membership required for analytics")
    if not response.is_success:
        raise RuntimeError(f"Analytics backend error {response.status_code}")
    data = response.json()
    return data.get("data", data)

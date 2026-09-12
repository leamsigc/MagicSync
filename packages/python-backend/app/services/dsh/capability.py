"""Scoped capability tokens for DSH tool execution (T30.2, PRD §8).

Replaces the shared-secret-plus-caller-supplied-user-ID pattern with a
short-lived signed scope. The DSH plugin never accepts a caller-supplied
``user_id`` as authority: every tool call must present a capability whose
signature, audience, expiry, nonce, business, run, and tool scope verify.
"""

import logging
import time
import uuid

import jwt

logger = logging.getLogger(__name__)

AUDIENCE = "magicsync-dsh"
ALGORITHM = "HS256"
DEFAULT_TTL_SECONDS = 600
MAX_TTL_SECONDS = 3600

_nonce_seen: dict[str, float] = {}


class CapabilityError(ValueError):
    """Capability verification failure with a machine-readable code."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _prune_nonces(now: float) -> None:
    expired = [nonce for nonce, exp in _nonce_seen.items() if exp <= now]
    for nonce in expired:
        del _nonce_seen[nonce]


def issue_capability(
    *,
    secret: str,
    user_id: str,
    business_id: str,
    workflow_id: str,
    run_id: str,
    allowed_tools: list,
    allowed_skills: list | None = None,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> str:
    """Mint a short-lived scoped capability token."""
    if not secret:
        raise CapabilityError("misconfigured", "Capability secret is not configured")
    if ttl_seconds <= 0 or ttl_seconds > MAX_TTL_SECONDS:
        raise CapabilityError("invalid_ttl", "Capability TTL out of range")
    now = int(time.time())
    payload = {
        "sub": user_id,
        "businessId": business_id,
        "workflowId": workflow_id,
        "runId": run_id,
        "allowedTools": list(allowed_tools),
        "allowedSkills": list(allowed_skills or []),
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + ttl_seconds,
        "nonce": uuid.uuid4().hex,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def verify_capability(
    token: str,
    *,
    secret: str,
    business_id: str,
    run_id: str,
    tool: str | None = None,
) -> dict:
    """Verify a capability and its scope. Returns the decoded claims.

    Raises CapabilityError with codes: misconfigured, invalid, expired,
    replayed, wrong_audience, wrong_business, wrong_run, tool_denied.
    """
    if not secret:
        raise CapabilityError("misconfigured", "Capability secret is not configured")
    try:
        claims = jwt.decode(token, secret, algorithms=[ALGORITHM], audience=AUDIENCE)
    except jwt.ExpiredSignatureError as exc:
        raise CapabilityError("expired", "Capability token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise CapabilityError("invalid", f"Invalid capability token: {exc}") from exc
    now = time.time()
    _prune_nonces(now)
    nonce = claims.get("nonce")
    if not nonce or nonce in _nonce_seen:
        raise CapabilityError("replayed", "Capability nonce missing or already used")
    if claims.get("businessId") != business_id:
        raise CapabilityError("wrong_business", "Capability is bound to another business")
    if claims.get("runId") != run_id:
        raise CapabilityError("wrong_run", "Capability is bound to another run")
    if tool is not None and tool not in (claims.get("allowedTools") or []):
        raise CapabilityError("tool_denied", f"Tool {tool!r} is outside the capability scope")
    _nonce_seen[nonce] = float(claims.get("exp", now))
    return claims


def clear_nonce_cache() -> None:
    """Test helper: reset the replay store."""
    _nonce_seen.clear()

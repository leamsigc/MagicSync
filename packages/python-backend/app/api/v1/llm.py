import logging
import os
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import UserContext, require_user
from app.services.llm import llm_service

logger = logging.getLogger(__name__)

router = APIRouter()


class LlmTestRequest(BaseModel):
    provider: str | None = Field(default=None)
    model: str | None = Field(default=None)
    api_key: str | None = Field(default=None)
    api_base: str | None = Field(default=None)

PROVIDER_ENV_KEYS = {
    "google": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "ollama": None,
}


@router.get("/providers")
async def list_providers(user: UserContext = Depends(require_user)):
    """Harness-supported LLM providers, system default, and key status.

    The frontend LLM settings page uses this so users only pick providers
    the agent harness can actually run.
    """
    providers = []
    for provider in settings.supported_providers:
        env_key = PROVIDER_ENV_KEYS.get(provider)
        providers.append({
            "provider": provider,
            "default_model": settings.google_default_model if provider == "google" else None,
            "server_key_configured": bool(env_key and os.environ.get(env_key)),
            "user_key_configured": bool(user.llm_config.api_key) if user.llm_config.provider == provider else False,
        })
    return {
        "providers": providers,
        "default_provider": settings.default_provider,
        "default_model": settings.google_default_model,
        "active": {
            "provider": user.llm_config.provider,
            "model": user.llm_config.model,
        },
    }


def _resolve_test_target(body: LlmTestRequest, user: UserContext) -> tuple:
    """Merge explicit body params over JWT creds. Never returns the key itself."""
    provider = body.provider or user.llm_config.provider
    model = body.model or user.llm_config.model
    api_key = body.api_key or user.llm_config.api_key
    api_base = body.api_base or user.llm_config.api_base
    return (provider, model, api_key, api_base)


@router.post("/test")
async def test_connection(body: LlmTestRequest, user: UserContext = Depends(require_user)):
    """Verify provider credentials with one tiny litellm completion.

    Falls back to JWT creds when api_key/api_base (or provider/model)
    are omitted. Never echoes the key back.
    """
    provider, model, api_key, api_base = _resolve_test_target(body, user)
    if provider not in settings.supported_providers:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
    t0 = time.monotonic()
    try:
        result = await llm_service.test_connection(provider, model, api_key, api_base)
    except Exception as exc:
        latency_ms = int((time.monotonic() - t0) * 1000)
        logger.warning("llm test failed provider=%s model=%s latency=%dms err=%s", provider, model, latency_ms, str(exc)[:200])
        raise HTTPException(status_code=502, detail=f"LLM test failed: {str(exc)[:200]}")
    return {"ok": True, "model_used": result["model_used"], "latency_ms": result["latency_ms"]}

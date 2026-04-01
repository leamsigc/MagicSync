import jwt
import base64
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from dataclasses import dataclass
from app.core.config import settings


security = HTTPBearer(auto_error=False)


@dataclass
class LlmConfig:
    """LLM configuration extracted from JWT."""

    provider: str = "ollama"
    model: str = "qwen3.5"
    api_key: str | None = None
    api_base: str | None = None
    temperature: float = 0.7
    max_tokens: int = 120000


@dataclass
class UserContext:
    """User context extracted from JWT."""

    user_id: str
    email: str
    llm_config: LlmConfig


def decode_llm_jwt(token: str) -> UserContext | None:
    """
    Decode and validate JWT token from Nuxt backend.
    Extracts user info and LLM config.
    """
    try:
        payload = jwt.decode(
            token,
            settings.llm_jwt_secret,
            algorithms=["HS256"],
            issuer="magicsync-nuxt",
            audience="magicsync-python",
        )

        # Decrypt API key if present
        api_key = None
        if payload.get("apiKeyEncrypted"):
            try:
                api_key = base64.b64decode(payload["apiKeyEncrypted"]).decode("utf-8")
            except Exception:
                api_key = None

        llm_config = LlmConfig(
            provider=payload.get("provider", "ollama"),
            model=payload.get("model", settings.ollama_default_model),
            api_key=api_key,
            api_base=payload.get("apiBaseUrl"),
            temperature=payload.get("temperature", 0.7),
            max_tokens=payload.get("maxTokens", 2048),
        )

        return UserContext(
            user_id=payload["userId"],
            email=payload.get("email", ""),
            llm_config=llm_config,
        )
    except jwt.InvalidTokenError:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> UserContext:
    """
    Extract user context from JWT token.

    The JWT contains:
    - userId: User ID from Nuxt
    - email: User email
    - provider: LLM provider (ollama, openai, anthropic, openrouter)
    - model: Model name
    - apiKeyEncrypted: Base64 encoded API key (if user has BYOK)
    - apiBaseUrl: Custom API base URL
    - temperature: Default temperature
    - maxTokens: Default max tokens
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token required",
        )

    user_context = decode_llm_jwt(credentials.credentials)
    if not user_context:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return user_context


def require_user(user: UserContext = Depends(get_current_user)) -> UserContext:
    """Dependency to require authenticated user with LLM config."""
    return user


# For lifespan cleanup - initialize as None
_auth_client = None

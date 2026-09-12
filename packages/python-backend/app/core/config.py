import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "MagicSync AI Backend"
    app_version: str = "0.1.0"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]
    better_auth_url: str = "http://localhost:3000"
    llm_jwt_secret: str = "magicsync-llm-secret-change-me"
    # Mirrors Nuxt NUXT_PUBLISH_SECRET (publish-crypto AES-256-GCM envelope).
    # When unset, the LLM JWT secret derives the encryption key, matching the
    # Nuxt fallback (NUXT_PUBLISH_SECRET || NUXT_LLM_JWT_SECRET).
    nuxt_publish_secret: str | None = None
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "qwen3.5"
    ollama_embedding_model: str = "mxbai-embed-large"
    # System default mirrors the Nuxt default LLM config (google provider).
    # Users can change provider/model in their LLM settings; the JWT carries it.
    default_provider: str = "google"
    google_default_model: str = "gemini-3-flash-preview"
    supported_providers: list[str] = ["google", "ollama", "openai", "anthropic", "openrouter", "deepseek"]
    # Shared secret for the dsh tool-bridge (dsh plugins call back into FastAPI).
    # Empty means the bridge is disabled: all /dsh routes fail closed (503).
    # Set DSH_BRIDGE_SECRET in the environment to enable it.
    dsh_bridge_secret: str = ""
    # DeepSeek Harness runtime (T30). The official SDK is pinned at build time;
    # the service boundary stays FastAPI while the SDK runs its child process.
    dsh_sdk_version: str = ""
    dsh_profile: str = "sdk"
    dsh_run_root: str = ".dsh-runs"
    dsh_max_duration_seconds: int = 600
    dsh_max_child_agents: int = 4
    dsh_max_agent_depth: int = 3
    dsh_max_tool_calls: int = 50
    dsh_max_output_bytes: int = 256_000
    dsh_max_concurrency: int = 4
    dsh_allow_network: bool = False
    dsh_plugin_manifest: str = ""
    # Loud local fallback when the SDK is absent (development only).
    # Production sets DSH_ALLOW_LOCAL_FALLBACK=false for a fail-closed 503.
    dsh_allow_local_fallback: bool = True
    dsh_home_root: str = ".dsh-homes"
    langsmith_api_key: str | None = None
    langsmith_project: str = "magicsync-ai"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    logger.info(
        f"[config] ollama_base_url=%s ollama_default_model=%s ollama_embedding_model=%s",
        s.ollama_base_url,
        s.ollama_default_model,
        s.ollama_embedding_model,
    )
    return s


settings = get_settings()

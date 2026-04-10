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
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "qwen3.5"
    ollama_embedding_model: str = "mxbai-embed-large"
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

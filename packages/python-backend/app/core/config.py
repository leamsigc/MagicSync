from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "MagicSync AI Backend"
    app_version: str = "0.1.0"
    debug: bool = False

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Better Auth (Nuxt server) - kept for backward compatibility
    better_auth_url: str = "http://localhost:3000"

    # JWT for service-to-service auth
    llm_jwt_secret: str = "magicsync-llm-secret-change-me"

    # Ollama (platform defaults)
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "qwen3.5"
    ollama_embedding_model: str = "nomic-embed-text"

    # LangSmith (optional)
    langsmith_api_key: str | None = None
    langsmith_project: str = "magicsync-ai"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

import pytest
from app.core.config import Settings


class TestSettings:
    def test_default_values(self):
        s = Settings(_env_file=None)
        assert s.app_name == "MagicSync AI Backend"
        assert s.app_version == "0.1.0"
        assert s.debug is False
        assert s.better_auth_url == "http://localhost:3000"
        assert s.ollama_base_url == "http://localhost:11434"
        assert s.ollama_default_model == "llama3.2"
        assert s.langsmith_project == "magicsync-ai"

    def test_cors_origins(self):
        s = Settings(_env_file=None)
        assert "http://localhost:3000" in s.cors_origins

from typing import AsyncGenerator
import litellm
from app.core.config import settings


class LLMService:
    """
    Unified LLM service using LiteLLM.

    Supports: Ollama, OpenAI, Anthropic, OpenRouter, Google, etc.

    Defaults to Ollama (platform default for Python backend).
    User config overrides are passed via headers from Nuxt.
    """

    def __init__(self):
        # Configure LiteLLM
        litellm.set_verbose = settings.debug

    async def chat(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        provider: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat responses from any LLM provider.

        Falls back to platform defaults if no provider/model specified.
        """
        provider = provider or "ollama"
        model = model or settings.ollama_default_model
        api_base = api_base or (
            settings.ollama_base_url if provider == "ollama" else None
        )

        litellm_model = self._format_model(model, provider)

        response = await litellm.acompletion(
            model=litellm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            api_base=api_base,
            stream=True,
            **kwargs,
        )

        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content

    async def chat_complete(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        provider: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        **kwargs,
    ) -> dict:
        """
        Complete chat without streaming.

        Falls back to platform defaults if no provider/model specified.
        """
        provider = provider or "ollama"
        model = model or settings.ollama_default_model
        api_base = api_base or (
            settings.ollama_base_url if provider == "ollama" else None
        )

        litellm_model = self._format_model(model, provider)

        response = await litellm.acompletion(
            model=litellm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            api_base=api_base,
            stream=False,
            **kwargs,
        )

        return {
            "message": {
                "role": "assistant",
                "content": response.choices[0].message.content,
            },
            "model": response.model,
        }

    def _format_model(self, model: str, provider: str) -> str:
        """Format model string for LiteLLM based on provider."""
        # If model already has provider prefix, use as-is
        if "/" in model:
            return model

        provider_prefix_map = {
            "ollama": f"ollama/{model}",
            "openai": model,
            "anthropic": f"anthropic/{model}",
            "openrouter": f"openrouter/{model}",
            "google": f"google/{model}",
        }

        return provider_prefix_map.get(provider, model)

    async def close(self):
        """LiteLLM doesn't need explicit cleanup."""
        pass


# Single instance - this is THE llm service for the entire backend
llm_service = LLMService()

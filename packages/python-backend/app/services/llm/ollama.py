import logging
import time
from typing import AsyncGenerator

import litellm

from app.core.config import settings

logger = logging.getLogger("llm")


class LLMService:
    """
    Unified LLM service using LiteLLM.

    Supports: Ollama, OpenAI, Anthropic, OpenRouter, Google, etc.

    Defaults to Ollama (platform default for Python backend).
    User config overrides are passed via headers from Nuxt.
    """

    def __init__(self):
        litellm.set_verbose = settings.debug
        # litellm internals use these callbacks for EVERY completion (streaming + non-streaming)
        # response_cost is available in kwargs["response_cost"] on success
        litellm.success_callback = [_log_success]
        litellm.failure_callback = [_log_failure]
        logger.info("LLMService initialized | callbacks registered")

    async def chat(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        provider: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        user_id: str | None = None,
        thread_id: str | None = None,
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

        logger.info(
            "stream_start model=%s provider=%s user=%s thread=%s",
            litellm_model,
            provider,
            user_id or "-",
            thread_id or "-",
        )

        t0 = time.monotonic()

        response = await litellm.acompletion(
            model=litellm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            api_base=api_base,
            stream=True,
            metadata={"user_id": user_id, "thread_id": thread_id},
            **kwargs,
        )

        # Collect chunks so we can rebuild the full response for usage data
        chunks = []
        async for chunk in response:
            chunks.append(chunk)
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content

        elapsed_ms = (time.monotonic() - t0) * 1000

        # Rebuild the complete response from chunks — this gives us .usage with token counts
        if chunks:
            try:
                complete = litellm.stream_chunk_builder(chunks, messages=messages)
                usage = getattr(complete, "usage", None)
                if usage:
                    logger.info(
                        "stream_usage model=%s prompt=%d completion=%d total=%d elapsed=%.0fms",
                        litellm_model,
                        getattr(usage, "prompt_tokens", 0),
                        getattr(usage, "completion_tokens", 0),
                        getattr(usage, "total_tokens", 0),
                        elapsed_ms,
                    )
                # cost is set by litellm's success_callback, but we can also read it here
                cost = getattr(complete, "_hidden_params", {}).get("response_cost")
                if cost:
                    logger.info("stream_cost model=%s cost=$%.6f", litellm_model, cost)
            except Exception as e:
                logger.warning("stream_chunk_builder failed: %s", e)

        logger.info(
            "stream_end model=%s chunks=%d elapsed=%.0fms",
            litellm_model,
            len(chunks),
            elapsed_ms,
        )

    async def chat_complete(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        provider: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        user_id: str | None = None,
        thread_id: str | None = None,
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

        logger.info(
            "complete_start model=%s provider=%s user=%s",
            litellm_model,
            provider,
            user_id or "-",
        )

        response = await litellm.acompletion(
            model=litellm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            api_base=api_base,
            stream=False,
            metadata={"user_id": user_id, "thread_id": thread_id},
            **kwargs,
        )

        # Non-streaming: usage and cost are on the response directly
        usage = getattr(response, "usage", None)
        if usage:
            logger.info(
                "complete_usage model=%s prompt=%d completion=%d total=%d",
                litellm_model,
                getattr(usage, "prompt_tokens", 0),
                getattr(usage, "completion_tokens", 0),
                getattr(usage, "total_tokens", 0),
            )

        cost = getattr(response, "_hidden_params", {}).get("response_cost")
        if cost:
            logger.info("complete_cost model=%s cost=$%.6f", litellm_model, cost)

        return {
            "message": {
                "role": "assistant",
                "content": response.choices[0].message.content,
            },
            "model": response.model,
        }

    def _format_model(self, model: str, provider: str) -> str:
        """Format model string for LiteLLM based on provider."""
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
        pass


# ---- litellm global callbacks (sync functions — litellm calls these internally) ----

def _log_success(kwargs, completion_response, start_time, end_time):
    """Called by litellm after any successful completion (streaming or non-streaming)."""
    try:
        model = kwargs.get("model", "unknown")
        cost = kwargs.get("response_cost", 0) or 0
        latency_ms = (end_time - start_time).total_seconds() * 1000

        metadata = kwargs.get("litellm_params", {}).get("metadata", {})
        user_id = metadata.get("user_id", "-")
        thread_id = metadata.get("thread_id", "-")

        # For non-streaming, usage is on the response object directly
        usage = getattr(completion_response, "usage", None)
        prompt_t = getattr(usage, "prompt_tokens", 0) if usage else 0
        comp_t = getattr(usage, "completion_tokens", 0) if usage else 0
        total_t = getattr(usage, "total_tokens", 0) if usage else 0

        logger.info(
            "callback_success model=%s cost=$%.6f prompt=%d completion=%d total=%d latency=%.0fms user=%s thread=%s",
            model, cost, prompt_t, comp_t, total_t, latency_ms, user_id, thread_id,
        )
    except Exception as e:
        logger.warning("success_callback error: %s", e)


def _log_failure(kwargs, completion_response, start_time, end_time):
    """Called by litellm after any failed completion."""
    try:
        model = kwargs.get("model", "unknown")
        error = kwargs.get("exception", completion_response)
        latency_ms = (end_time - start_time).total_seconds() * 1000

        logger.error(
            "callback_failure model=%s error=%s latency=%.0fms",
            model, str(error)[:200], latency_ms,
        )
    except Exception as e:
        logger.warning("failure_callback error: %s", e)


# Single instance
llm_service = LLMService()

import asyncio
import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.ollama_base_url
        self.default_model = settings.ollama_embedding_model
        self.client = httpx.AsyncClient(timeout=120.0)
        self._semaphore = asyncio.Semaphore(10)

    async def embed(self, text: str, model: str | None = None) -> list[float]:
        """Generate embedding for a single text."""
        model = model or self.default_model
        logger.info(f"[embed] model={model} base_url={self.base_url}")
        url = f"{self.base_url}/api/embeddings"
        payload = {"model": model, "prompt": text}

        try:
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["embedding"]
        except Exception as e:
            logger.error(f"[embed] ERROR: model={model} url={url} error={e}")
            raise

    async def embed_batch(
        self, texts: list[str], model: str | None = None
    ) -> list[list[float]]:
        """Generate embeddings for multiple texts concurrently.

        Uses semaphore to limit concurrent requests to Ollama.
        Falls back to sequential on individual failures.
        """
        model = model or self.default_model

        if not texts:
            return []

        async def _embed_with_limit(text: str, index: int) -> tuple[int, list[float]]:
            async with self._semaphore:
                emb = await self.embed(text, model)
                return index, emb

        try:
            tasks = [_embed_with_limit(text, i) for i, text in enumerate(texts)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            embeddings: list[list[float]] = [None] * len(texts)  # type: ignore
            failed_indices: list[int] = []

            for result in results:
                if isinstance(result, Exception):
                    logger.warning(f"Batch embedding failed for one text: {result}")
                    # Find which index failed — we'll retry sequentially
                    continue
                index, emb = result
                embeddings[index] = emb

            # Retry failed ones sequentially
            for i, emb in enumerate(embeddings):
                if emb is None:
                    try:
                        embeddings[i] = await self.embed(texts[i], model)
                    except Exception as e:
                        logger.error(f"Failed to embed text {i}: {e}")
                        embeddings[i] = []

            return embeddings
        except Exception as e:
            logger.error(f"Batch embedding failed entirely, falling back to sequential: {e}")
            embeddings = []
            for text in texts:
                try:
                    emb = await self.embed(text, model)
                    embeddings.append(emb)
                except Exception:
                    embeddings.append([])
            return embeddings

    async def list_embedding_models(self) -> list[str]:
        """List available embedding models from Ollama."""
        url = f"{self.base_url}/api/tags"
        response = await self.client.get(url)
        response.raise_for_status()
        data = response.json()
        models = data.get("models", [])
        return [m["name"] for m in models if "embed" in m["name"].lower()]

    async def close(self):
        await self.client.aclose()


embedding_service = EmbeddingService()

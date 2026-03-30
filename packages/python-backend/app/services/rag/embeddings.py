import json
import httpx
from typing import AsyncGenerator
from app.core.config import settings


class EmbeddingService:
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.ollama_base_url
        self.client = httpx.AsyncClient(timeout=120.0)

    async def embed(self, text: str, model: str = "nomic-embed-text") -> list[float]:
        """Generate embedding for a single text."""
        url = f"{self.base_url}/api/embeddings"
        payload = {"model": model, "prompt": text}

        response = await self.client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["embedding"]

    async def embed_batch(
        self, texts: list[str], model: str = "nomic-embed-text"
    ) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        embeddings = []
        for text in texts:
            emb = await self.embed(text, model)
            embeddings.append(emb)
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

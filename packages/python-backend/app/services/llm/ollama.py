import json
import httpx
from typing import AsyncGenerator
from app.core.config import settings
from app.services.tracing.decorators import traceable


class OllamaService:
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.ollama_base_url
        self.client = httpx.AsyncClient(timeout=120.0)
        self.default_model = settings.ollama_default_model

    @traceable(project_name=settings.langsmith_project)
    async def chat(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        stream: bool = True,
    ) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }

        async with self.client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.strip():
                    data = json.loads(line)
                    if "message" in data:
                        yield data["message"].get("content", "")
                    if data.get("done", False):
                        break

    @traceable(project_name=settings.langsmith_project)
    async def chat_complete(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
    ) -> dict:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }

        response = await self.client.post(url, json=payload)
        response.raise_for_status()
        return response.json()

    async def list_models(self) -> list[dict]:
        url = f"{self.base_url}/api/tags"
        response = await self.client.get(url)
        response.raise_for_status()
        data = response.json()
        return data.get("models", [])

    async def close(self):
        await self.client.aclose()


ollama_service = OllamaService()

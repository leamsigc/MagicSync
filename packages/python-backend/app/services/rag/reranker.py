import httpx
from app.core.config import settings


class RerankerService:
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.ollama_base_url
        self.client = httpx.AsyncClient(timeout=60.0)

    async def rerank(
        self,
        query: str,
        documents: list[str],
        model: str = "llama3.2",
        top_k: int = 5,
    ) -> list[dict]:
        prompt = self._build_rerank_prompt(query, documents)

        response = await self.client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
            },
        )
        response.raise_for_status()
        result = response.json()
        return self._parse_rerank_output(result.get("response", ""), documents)

    def _build_rerank_prompt(self, query: str, documents: list[str]) -> str:
        doc_list = "\n".join(
            [f"[{i}] {doc[:500]}" for i, doc in enumerate(documents)]
        )
        return (
            f"Rank the following documents by relevance to the query: '{query}'\n\n"
            f"Documents:\n{doc_list}\n\n"
            f"Return only a comma-separated list of document indices ordered by relevance "
            f"(most relevant first). Example: 2,0,1,3"
        )

    def _parse_rerank_output(
        self, response: str, documents: list[str]
    ) -> list[dict]:
        try:
            indices = [
                int(idx.strip())
                for idx in response.split(",")
                if idx.strip().isdigit()
            ]
        except (ValueError, AttributeError):
            indices = list(range(len(documents)))

        seen = set()
        ordered = []
        for idx in indices:
            if idx not in seen and 0 <= idx < len(documents):
                seen.add(idx)
                ordered.append({"index": idx, "score": 1.0 / (idx + 1)})

        for i in range(len(documents)):
            if i not in seen:
                ordered.append({"index": i, "score": 0.0})

        return ordered[: len(documents)]

    async def close(self):
        await self.client.aclose()


reranker_service = RerankerService()
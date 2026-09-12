import httpx

from app.services.research.channels.base import Channel

READER_BASE = "https://r.jina.ai/"


class WebChannel(Channel):
    name = "web"
    description = "Read any web page as markdown"
    backends = ["jina-reader"]
    tier = 0

    def can_handle(self, url: str) -> bool:
        return url.startswith("http://") or url.startswith("https://")

    def check(self, config: dict | None = None) -> tuple[str, str]:
        try:
            response = httpx.get(f"{READER_BASE}https://example.com", timeout=10)
            if response.status_code < 500:
                self.active_backend = "jina-reader"
                return "ok", "jina-reader reachable"
        except Exception as exc:
            self.active_backend = None
            return "error", f"jina-reader unreachable: {exc}"
        self.active_backend = None
        return "warn", "jina-reader returned an error"

    async def read(self, url: str) -> str:
        from app.services.research.ssrf import validate_url

        safe_url = validate_url(url)
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{READER_BASE}{safe_url}")
            response.raise_for_status()
            return response.text

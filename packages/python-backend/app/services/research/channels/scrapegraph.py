from app.services.research.channels.base import Channel


class ScrapeGraphChannel(Channel):
    name = "scrapegraph"
    description = "AI extraction from any page (prompt → structured data)"
    backends = ["smartscraper", "markdownify"]
    tier = 1

    def can_handle(self, url: str) -> bool:
        return url.startswith("http://") or url.startswith("https://")

    def check(self, config: dict | None = None) -> tuple[str, str]:
        from app.services.research import scraper

        if not scraper.is_smartscraper_available():
            self.active_backend = None
            return "off", "scrapegraphai not installed"
        provider = (config or {}).get("scraper_provider", "ollama")
        if scraper.has_llm_configured(provider):
            self.active_backend = "smartscraper"
            return "ok", f"smartscraper ready ({provider})"
        self.active_backend = "markdownify"
        return "warn", "no LLM key — markdown-only mode"

import logging
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)


class WebSearchService:
    """Search the web using DuckDuckGo."""

    async def search(self, query: str, max_results: int = 5) -> dict:
        """Search the web and return structured results."""
        try:
            results = []
            with DDGS() as ddgs:
                raw = ddgs.text(query, max_results=max_results)
                for r in raw:
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", ""),
                    })

            return {
                "query": query,
                "results": results,
                "total_results": len(results),
            }
        except Exception as e:
            logger.error(f"Web search failed for query '{query}': {e}")
            return {
                "query": query,
                "results": [],
                "total_results": 0,
            }


web_search_service = WebSearchService()

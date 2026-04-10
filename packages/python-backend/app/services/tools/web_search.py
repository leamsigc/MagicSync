import logging
from duckduckgo_search import DDGS
import asyncio
import time

logger = logging.getLogger(__name__)


class WebSearchService:
    """Search the web using DuckDuckGo with Brave Search fallback."""

    def __init__(self):
        self.last_request_time = 0
        self.min_interval = 2.0  # Minimum seconds between requests
        self.brave_api_key = None  # Can be set via environment variable

    async def search(self, query: str, max_results: int = 5) -> dict:
        """Search the web, falling back to Brave Search on rate limit."""
        
        # Try DuckDuckGo first
        ddg_result = await self._duckduckgo_search(query, max_results)
        
        # If rate limited or no results, try fallback
        is_rate_limited = ddg_result.get('error') and 'Ratelimit' in str(ddg_result.get('error', ''))
        is_failed = ddg_result.get('error') and not ddg_result.get('results')
        
        if is_rate_limited or is_failed:
            logger.info("DuckDuckGo failed or rate limited, trying fallback")
            fallback_result = await self._fallback_search(query, max_results)
            if fallback_result.get('results'):
                return fallback_result
            # If fallback also has no results, return a more helpful message
            return {
                "query": query,
                "results": [],
                "total_results": 0,
                "error": "All search services rate limited. Please wait 30-60 seconds and try again.",
            }
        
        return ddg_result

    async def _duckduckgo_search(self, query: str, max_results: int) -> dict:
        """Search using DuckDuckGo."""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_interval:
            await asyncio.sleep(self.min_interval - time_since_last)
        
        self.last_request_time = time.time()
        
        for attempt in range(3):  # Try up to 3 times with backoff
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
                    "source": "duckduckgo",
                }
            except Exception as e:
                error_str = str(e)
                if "Ratelimit" in error_str or "202" in error_str:
                    wait_time = (attempt + 1) * 3  # Exponential backoff
                    logger.warning(f"DuckDuckGo rate limited, attempt {attempt+1}/3, waiting {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                logger.error(f"DuckDuckGo search failed: {e}")
                return {
                    "query": query,
                    "results": [],
                    "total_results": 0,
                    "error": f"DuckDuckGo error: {error_str}",
                }
        
        # All attempts failed
        return {
            "query": query,
            "results": [],
            "total_results": 0,
            "error": "DuckDuckGo rate limited after multiple attempts. Please wait and try again.",
        }

    async def _brave_search(self, query: str, max_results: int) -> dict:
        """Fallback search using Brave Search API (free tier)."""
        try:
            # Brave Search free API - requires API key, but we can try without
            # For now, return empty so user knows to use different search
            # In production, you'd set BRAVE_API_KEY env var
            if not self.brave_api_key:
                # Try using html requests as fallback
                return await self._fallback_search(query, max_results)
            
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    headers={"Accept": "application/json"},
                    params={"q": query, "count": max_results},
                    timeout=10.0,
                )
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    for item in data.get("web", {}).get("results", []):
                        results.append({
                            "title": item.get("title", ""),
                            "url": item.get("url", ""),
                            "snippet": item.get("description", ""),
                        })
                    return {
                        "query": query,
                        "results": results,
                        "total_results": len(results),
                        "source": "brave",
                    }
        except Exception as e:
            logger.warning(f"Brave Search fallback failed: {e}")
        
        return {"query": query, "results": [], "total_results": 0}

    async def _fallback_search(self, query: str, max_results: int) -> dict:
        """Final fallback - try a simple HTTP-based search."""
        try:
            import httpx
            import re
            
            # Try DuckDuckGo lite (HTML-based, less strict)
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": query},
                    timeout=15.0,
                )
                if response.status_code == 200:
                    html = response.text
                    results = []
                    # Parse result links
                    link_pattern = r'<a class="result__a" href="([^"]+)"[^>]*>([^<]+)</a>'
                    for url, title in re.findall(link_pattern, html)[:max_results]:
                        results.append({
                            "title": title.strip(),
                            "url": url.strip(),
                            "snippet": "Click to view",
                        })
                    if results:
                        return {
                            "query": query,
                            "results": results,
                            "total_results": len(results),
                            "source": "duckduckgo-html",
                        }
        except Exception as e:
            logger.warning(f"Fallback search failed: {e}")
        
        return {"query": query, "results": [], "total_results": 0}


web_search_service = WebSearchService()

import pytest
from unittest.mock import MagicMock, patch


class TestWebSearchService:
    """Test web search functionality."""

    @pytest.mark.asyncio
    async def test_search_returns_results(self):
        from app.services.tools.web_search import web_search_service

        mock_results = [
            {"title": "Social Media Tips", "href": "https://example.com/tips", "body": "Best practices."},
            {"title": "Instagram Guide", "href": "https://example.com/ig", "body": "Grow following."},
        ]

        mock_ddgs = MagicMock()
        mock_ddgs.text.return_value = mock_results
        mock_ddgs.__enter__ = MagicMock(return_value=mock_ddgs)
        mock_ddgs.__exit__ = MagicMock(return_value=False)

        with patch("app.services.tools.web_search.DDGS", return_value=mock_ddgs):
            result = await web_search_service.search("social media", max_results=5)
            assert result["query"] == "social media"
            assert len(result["results"]) == 2
            assert result["results"][0]["title"] == "Social Media Tips"
            assert result["total_results"] == 2

    @pytest.mark.asyncio
    async def test_search_handles_empty_results(self):
        from app.services.tools.web_search import web_search_service

        mock_ddgs = MagicMock()
        mock_ddgs.text.return_value = []
        mock_ddgs.__enter__ = MagicMock(return_value=mock_ddgs)
        mock_ddgs.__exit__ = MagicMock(return_value=False)

        with patch("app.services.tools.web_search.DDGS", return_value=mock_ddgs):
            result = await web_search_service.search("obscure query")
            assert result["results"] == []
            assert result["total_results"] == 0

    @pytest.mark.asyncio
    async def test_search_handles_error_gracefully(self):
        from app.services.tools.web_search import web_search_service

        with patch("app.services.tools.web_search.DDGS", side_effect=Exception("Network error")):
            result = await web_search_service.search("test query")
            assert result["results"] == []
            assert result["total_results"] == 0


class TestWebSearchEndpoint:
    """Test the /tools/web-search API endpoint."""

    def test_search_endpoint_returns_results(self, client, api_prefix, test_headers):
        mock_results = [{"title": "Test", "href": "https://example.com", "body": "A result."}]

        mock_ddgs = MagicMock()
        mock_ddgs.text.return_value = mock_results
        mock_ddgs.__enter__ = MagicMock(return_value=mock_ddgs)
        mock_ddgs.__exit__ = MagicMock(return_value=False)

        with patch("app.services.tools.web_search.DDGS", return_value=mock_ddgs):
            response = client.post(
                f"{api_prefix}/tools/web-search",
                json={"query": "test search", "max_results": 3},
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["query"] == "test search"
            assert len(data["results"]) == 1

    def test_search_empty_query_rejected(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/tools/web-search",
            json={"query": ""},
            headers=test_headers,
        )
        assert response.status_code in (400, 422)

    def test_search_no_query_rejected(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/tools/web-search",
            json={},
            headers=test_headers,
        )
        assert response.status_code in (400, 422)

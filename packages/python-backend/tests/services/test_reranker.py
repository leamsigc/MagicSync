import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.rag.reranker import RerankerService


class TestRerankerService:
    @pytest.fixture
    def reranker(self):
        return RerankerService(base_url="http://localhost:11434")

    def test_build_rerank_prompt(self, reranker):
        query = "social media marketing"
        documents = ["Doc A about marketing", "Doc B about cooking", "Doc C about social media"]

        prompt = reranker._build_rerank_prompt(query, documents)

        assert "social media marketing" in prompt
        assert "[0] Doc A about marketing" in prompt
        assert "[1] Doc B about cooking" in prompt
        assert "[2] Doc C about social media" in prompt
        assert "comma-separated list of document indices" in prompt

    def test_parse_rerank_output_valid(self, reranker):
        response = "2,0,1"
        documents = ["Doc A", "Doc B", "Doc C"]

        result = reranker._parse_rerank_output(response, documents)

        assert len(result) == 3
        assert result[0]["index"] == 2
        assert result[1]["index"] == 0
        assert result[2]["index"] == 1

    def test_parse_rerank_output_invalid(self, reranker):
        response = "invalid response"
        documents = ["Doc A", "Doc B"]

        result = reranker._parse_rerank_output(response, documents)

        assert len(result) == 2
        assert result[0]["index"] == 0
        assert result[1]["index"] == 1

    def test_parse_rerank_output_out_of_range(self, reranker):
        response = "5,0,1"
        documents = ["Doc A", "Doc B"]

        result = reranker._parse_rerank_output(response, documents)

        assert len(result) == 2
        assert result[0]["index"] == 0
        assert result[1]["index"] == 1

    def test_parse_rerank_output_duplicates(self, reranker):
        response = "0,0,1"
        documents = ["Doc A", "Doc B"]

        result = reranker._parse_rerank_output(response, documents)

        assert len(result) == 2
        indices = [r["index"] for r in result]
        assert indices.count(0) == 1

    @pytest.mark.asyncio
    async def test_rerank_api_call(self, reranker):
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "1,0,2"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(reranker.client, 'post', new_callable=AsyncMock, return_value=mock_response):
            result = await reranker.rerank(
                query="test query",
                documents=["Doc A", "Doc B", "Doc C"],
                model="llama3.2",
                top_k=3,
            )

            assert len(result) == 3
            assert result[0]["index"] == 1
            assert result[1]["index"] == 0

    @pytest.mark.asyncio
    async def test_rerank_api_error(self, reranker):
        with patch.object(reranker.client, 'post', new_callable=AsyncMock, side_effect=Exception("API error")):
            with pytest.raises(Exception, match="API error"):
                await reranker.rerank(
                    query="test query",
                    documents=["Doc A"],
                )

    @pytest.mark.asyncio
    async def test_close(self, reranker):
        with patch.object(reranker.client, 'aclose', new_callable=AsyncMock) as mock_close:
            await reranker.close()
            mock_close.assert_called_once()
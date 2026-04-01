import pytest
from unittest.mock import AsyncMock, patch


class TestRagEndpoints:
    def test_ingest_document(self, client, api_prefix, test_headers):
        mock_embeddings = [[0.1, 0.2, 0.3] for _ in range(3)]

        with patch(
            "app.services.rag.embeddings.embedding_service.embed_batch",
            new_callable=AsyncMock,
            return_value=mock_embeddings,
        ):
            response = client.post(
                f"{api_prefix}/rag/ingest",
                json={
                    "document_id": "doc-1",
                    "filename": "test.txt",
                    "text": "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
                    "chunk_size": 512,
                    "chunk_overlap": 64,
                },
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["document_id"] == "doc-1"
            assert data["total_chunks"] > 0
            assert len(data["chunks"]) == data["total_chunks"]
            for chunk in data["chunks"]:
                assert "content" in chunk
                assert "embedding" in chunk
                assert "chunk_index" in chunk

    def test_ingest_empty_text(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/rag/ingest",
            json={
                "document_id": "doc-1",
                "text": "",
            },
            headers=test_headers,
        )
        # Pydantic validator rejects empty text before reaching the handler
        assert response.status_code == 422

    def test_ingest_whitespace_only(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/rag/ingest",
            json={
                "document_id": "doc-1",
                "text": "   \n\n   ",
            },
            headers=test_headers,
        )
        assert response.status_code == 400

    def test_ingest_custom_chunk_size(self, client, api_prefix, test_headers):
        long_text = "\n\n".join([f"Paragraph {i} with some content." for i in range(20)])

        with patch(
            "app.services.rag.embeddings.embedding_service.embed_batch",
            new_callable=AsyncMock,
            return_value=[[0.1] * 10 for _ in range(20)],
        ):
            response = client.post(
                f"{api_prefix}/rag/ingest",
                json={
                    "document_id": "doc-1",
                    "text": long_text,
                    "chunk_size": 64,
                    "chunk_overlap": 16,
                },
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["total_chunks"] > 1

    def test_retrieve_query(self, client, api_prefix, test_headers):
        with patch(
            "app.services.rag.embeddings.embedding_service.embed",
            new_callable=AsyncMock,
            return_value=[0.1, 0.2, 0.3, 0.4, 0.5],
        ):
            response = client.post(
                f"{api_prefix}/rag/retrieve",
                json={
                    "query": "social media marketing",
                    "top_k": 5,
                },
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["query"] == "social media marketing"
            assert len(data["embedding"]) == 5
            assert data["top_k"] == 5

    def test_retrieve_default_top_k(self, client, api_prefix, test_headers):
        with patch(
            "app.services.rag.embeddings.embedding_service.embed",
            new_callable=AsyncMock,
            return_value=[0.1, 0.2],
        ):
            response = client.post(
                f"{api_prefix}/rag/retrieve",
                json={"query": "test"},
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["top_k"] == 5

    def test_ingest_invalid_temperature(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/rag/ingest",
            json={
                "document_id": "doc-1",
                "text": "hello",
                "chunk_size": 10,
            },
            headers=test_headers,
        )
        assert response.status_code == 422

    def test_ingest_returns_content_hash(self, client, api_prefix, test_headers):
        mock_embeddings = [[0.1, 0.2, 0.3] for _ in range(3)]

        with patch(
            "app.services.rag.embeddings.embedding_service.embed_batch",
            new_callable=AsyncMock,
            return_value=mock_embeddings,
        ):
            response = client.post(
                f"{api_prefix}/rag/ingest",
                json={
                    "document_id": "doc-1",
                    "filename": "test.txt",
                    "text": "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
                    "chunk_size": 512,
                    "chunk_overlap": 64,
                },
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            for chunk in data["chunks"]:
                assert "content_hash" in chunk
                assert chunk["content_hash"]  # non-empty string
                assert len(chunk["content_hash"]) == 64  # SHA-256 hex

    def test_ingest_content_hash_deterministic(self, client, api_prefix, test_headers):
        mock_embeddings = [[0.1, 0.2] for _ in range(2)]

        request_body = {
            "document_id": "doc-1",
            "filename": "test.txt",
            "text": "Same content for both requests.",
            "chunk_size": 512,
            "chunk_overlap": 64,
        }

        with patch(
            "app.services.rag.embeddings.embedding_service.embed_batch",
            new_callable=AsyncMock,
            return_value=mock_embeddings,
        ):
            response1 = client.post(
                f"{api_prefix}/rag/ingest",
                json=request_body,
                headers=test_headers,
            )
            response2 = client.post(
                f"{api_prefix}/rag/ingest",
                json=request_body,
                headers=test_headers,
            )

            chunks1 = response1.json()["chunks"]
            chunks2 = response2.json()["chunks"]
            assert chunks1[0]["content_hash"] == chunks2[0]["content_hash"]

    def test_hybrid_search_with_embedding(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/rag/hybrid-search",
            json={
                "query": "social media tips",
                "query_embedding": [0.1, 0.2, 0.3, 0.4, 0.5],
                "top_k": 5,
            },
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "social media tips"
        assert "results" in data
        assert "total_results" in data
        assert "reranked" in data

    def test_hybrid_search_with_reranking(self, client, api_prefix, test_headers):
        """Reranking is now handled by the dedicated /rerank endpoint."""
        response = client.post(
            f"{api_prefix}/rag/hybrid-search",
            json={
                "query": "marketing strategy",
                "query_embedding": [0.1, 0.2, 0.3],
                "top_k": 3,
                "use_rerank": True,
                "rerank_model": "llama3.2",
            },
            headers=test_headers,
        )
        # Hybrid-search returns 501 for reranking — callers should use /rerank endpoint
        assert response.status_code == 501

    def test_hybrid_search_missing_query_and_embedding(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/rag/hybrid-search",
            json={
                "query": "",
                "query_embedding": [],
            },
            headers=test_headers,
        )
        assert response.status_code == 400

    def test_hybrid_search_with_document_filter(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/rag/hybrid-search",
            json={
                "query": "test query",
                "query_embedding": [0.1, 0.2, 0.3],
                "top_k": 5,
                "document_id": "doc-123",
                "metadata_filters": {"topic": "marketing"},
            },
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "test query"

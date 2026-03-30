import pytest
from unittest.mock import AsyncMock, patch


class TestRagEndpoints:
    def test_ingest_document(self, client, api_prefix):
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
                headers={"Authorization": "Bearer test-token"},
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

    def test_ingest_empty_text(self, client, api_prefix):
        response = client.post(
            f"{api_prefix}/rag/ingest",
            json={
                "document_id": "doc-1",
                "text": "",
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 400

    def test_ingest_whitespace_only(self, client, api_prefix):
        response = client.post(
            f"{api_prefix}/rag/ingest",
            json={
                "document_id": "doc-1",
                "text": "   \n\n   ",
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 400

    def test_ingest_custom_chunk_size(self, client, api_prefix):
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
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["total_chunks"] > 1

    def test_retrieve_query(self, client, api_prefix):
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
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["query"] == "social media marketing"
            assert len(data["embedding"]) == 5
            assert data["top_k"] == 5

    def test_retrieve_default_top_k(self, client, api_prefix):
        with patch(
            "app.services.rag.embeddings.embedding_service.embed",
            new_callable=AsyncMock,
            return_value=[0.1, 0.2],
        ):
            response = client.post(
                f"{api_prefix}/rag/retrieve",
                json={"query": "test"},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["top_k"] == 5

    def test_ingest_invalid_temperature(self, client, api_prefix):
        response = client.post(
            f"{api_prefix}/rag/ingest",
            json={
                "document_id": "doc-1",
                "text": "hello",
                "chunk_size": 10,
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422

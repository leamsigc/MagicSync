import pytest
from unittest.mock import AsyncMock, patch
from app.services.rag.metadata_extractor import extract_metadata, DocumentMetadata


class TestMetadataExtractor:
    @pytest.mark.asyncio
    async def test_extract_metadata_returns_document_metadata(self):
        mock_response = {
            "message": {
                "content": '{"title":"Test Doc","author":"John","language":"en","topics":["AI","RAG"],"summary":"A test document.","document_type":"guide"}'
            }
        }

        with patch(
            "app.services.rag.metadata_extractor.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await extract_metadata("This is a test document about AI and RAG systems.")
            assert isinstance(result, DocumentMetadata)
            assert result.title == "Test Doc"
            assert result.author == "John"
            assert result.language == "en"
            assert result.topics == ["AI", "RAG"]
            assert result.summary == "A test document."
            assert result.document_type == "guide"

    @pytest.mark.asyncio
    async def test_extract_metadata_handles_markdown_fences(self):
        mock_response = {
            "message": {
                "content": '```json\n{"title":"Fenced","author":"","language":"en","topics":["test"],"summary":"fenced doc","document_type":"other"}\n```'
            }
        }

        with patch(
            "app.services.rag.metadata_extractor.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await extract_metadata("Some text.")
            assert result.title == "Fenced"

    @pytest.mark.asyncio
    async def test_extract_metadata_handles_invalid_json(self):
        mock_response = {
            "message": {
                "content": "This is not JSON at all!"
            }
        }

        with patch(
            "app.services.rag.metadata_extractor.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await extract_metadata("Some text.")
            assert result.title == ""
            assert result.topics == []
            assert result.language == "en"

    @pytest.mark.asyncio
    async def test_extract_metadata_handles_empty_text(self):
        result = await extract_metadata("")
        assert result.title == ""
        assert result.topics == []

    @pytest.mark.asyncio
    async def test_extract_metadata_handles_whitespace_only(self):
        result = await extract_metadata("   \n\n   ")
        assert result.title == ""

    @pytest.mark.asyncio
    async def test_extract_metadata_handles_llm_error(self):
        with patch(
            "app.services.rag.metadata_extractor.ollama_service.chat_complete",
            new_callable=AsyncMock,
            side_effect=Exception("Ollama unavailable"),
        ):
            result = await extract_metadata("Some text.")
            assert result.title == ""
            assert result.language == "en"

    @pytest.mark.asyncio
    async def test_extract_metadata_truncates_long_text(self):
        mock_response = {
            "message": {
                "content": '{"title":"Long","author":"","language":"en","topics":[],"summary":".","document_type":"other"}'
            }
        }

        long_text = "A" * 10000

        with patch(
            "app.services.rag.metadata_extractor.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ) as mock_llm:
            await extract_metadata(long_text)
            # Check that the prompt was called with truncated text
            call_args = mock_llm.call_args
            prompt = call_args.kwargs["messages"][0]["content"]
            # The text in the prompt should be at most 3000 chars
            assert "A" * 3001 not in prompt


class TestExtractMetadataEndpoint:
    def test_extract_metadata_success(self, client, api_prefix):
        mock_response = {
            "message": {
                "content": '{"title":"API Test","author":"Tester","language":"en","topics":["testing"],"summary":"A test.","document_type":"technical"}'
            }
        }

        with patch(
            "app.services.rag.metadata_extractor.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = client.post(
                f"{api_prefix}/rag/extract-metadata",
                json={"text": "This is test content for metadata extraction."},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["title"] == "API Test"
            assert data["author"] == "Tester"
            assert data["topics"] == ["testing"]
            assert data["document_type"] == "technical"

    def test_extract_metadata_empty_text(self, client, api_prefix):
        response = client.post(
            f"{api_prefix}/rag/extract-metadata",
            json={"text": ""},
            headers={"Authorization": "Bearer test-token"},
        )
        # Pydantic validator rejects empty text before reaching the handler
        assert response.status_code == 422

    def test_extract_metadata_whitespace_only(self, client, api_prefix):
        response = client.post(
            f"{api_prefix}/rag/extract-metadata",
            json={"text": "   \n   "},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 400

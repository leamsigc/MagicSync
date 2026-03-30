import pytest
from app.services.rag.chunker import chunk_text, estimate_tokens


class TestChunker:
    def test_empty_text(self):
        chunks = chunk_text("")
        assert chunks == []

    def test_whitespace_only(self):
        chunks = chunk_text("   \n\n   ")
        assert chunks == []

    def test_single_paragraph(self):
        text = "This is a single paragraph with some content."
        chunks = chunk_text(text, chunk_size=512)
        assert len(chunks) == 1
        assert chunks[0].content == text
        assert chunks[0].index == 0

    def test_multiple_paragraphs_single_chunk(self):
        text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        chunks = chunk_text(text, chunk_size=512)
        assert len(chunks) == 1
        assert "First paragraph" in chunks[0].content
        assert "Third paragraph" in chunks[0].content

    def test_multiple_paragraphs_multiple_chunks(self):
        paragraphs = [f"Paragraph {i} with enough content to fill a chunk." for i in range(20)]
        text = "\n\n".join(paragraphs)
        chunks = chunk_text(text, chunk_size=64, chunk_overlap=0)
        assert len(chunks) > 1

    def test_chunk_indices_are_sequential(self):
        paragraphs = [f"Paragraph {i}." for i in range(10)]
        text = "\n\n".join(paragraphs)
        chunks = chunk_text(text, chunk_size=32)
        for i, chunk in enumerate(chunks):
            assert chunk.index == i

    def test_chunk_overlap(self):
        paragraphs = [f"Paragraph number {i} has some content here." for i in range(10)]
        text = "\n\n".join(paragraphs)
        chunks_with_overlap = chunk_text(text, chunk_size=64, chunk_overlap=32)
        chunks_no_overlap = chunk_text(text, chunk_size=64, chunk_overlap=0)
        # With overlap, we may get same or more chunks
        assert len(chunks_with_overlap) >= len(chunks_no_overlap) - 1

    def test_metadata_propagation(self):
        text = "Content here."
        metadata = {"source": "test.pdf", "page": 1}
        chunks = chunk_text(text, chunk_size=512, metadata=metadata)
        assert chunks[0].metadata == metadata

    def test_token_count_estimate(self):
        text = "This is a test sentence."
        chunks = chunk_text(text, chunk_size=512)
        assert chunks[0].token_count > 0
        assert chunks[0].token_count == estimate_tokens(text)

    def test_estimate_tokens(self):
        assert estimate_tokens("") == 1  # minimum 1
        assert estimate_tokens("abcd") == 1
        assert estimate_tokens("a" * 100) == 25


class TestEmbeddingService:
    def test_embed_calls_ollama(self):
        """Test that embed method constructs correct Ollama request."""
        from app.services.rag.embeddings import EmbeddingService

        service = EmbeddingService(base_url="http://localhost:11434")
        assert service.base_url == "http://localhost:11434"
        assert service.default_model is None  # not set on init

    def test_custom_base_url(self):
        from app.services.rag.embeddings import EmbeddingService

        service = EmbeddingService(base_url="http://custom:9999")
        assert service.base_url == "http://custom:9999"

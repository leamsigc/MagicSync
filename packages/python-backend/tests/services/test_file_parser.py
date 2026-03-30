import pytest
import base64
from app.services.rag.file_parser import extract_text, _extract_html, _extract_markdown, SUPPORTED_TYPES


class TestFileParser:
    def test_extract_plain_text(self):
        content = b"Hello world, this is plain text."
        result = extract_text(content, "text/plain")
        assert result == "Hello world, this is plain text."

    def test_extract_plain_text_utf8(self):
        content = "Héllo wörld".encode("utf-8")
        result = extract_text(content, "text/plain")
        assert result == "Héllo wörld"

    def test_extract_html(self):
        html = b"<html><body><h1>Title</h1><p>Paragraph content.</p></body></html>"
        result = extract_text(html, "text/html")
        assert "Title" in result
        assert "Paragraph content." in result

    def test_extract_html_removes_scripts(self):
        html = b"<html><head><script>alert('xss')</script></head><body><p>Safe content</p></body></html>"
        result = extract_text(html, "text/html")
        assert "alert" not in result
        assert "Safe content" in result

    def test_extract_html_removes_styles(self):
        html = b"<html><head><style>body{color:red}</style></head><body><p>Text</p></body></html>"
        result = extract_text(html, "text/html")
        assert "color:red" not in result
        assert "Text" in result

    def test_extract_markdown(self):
        md = b"# Title\n\nSome paragraph text.\n\n## Subtitle\n\nMore text."
        result = extract_text(md, "text/markdown")
        assert "Title" in result
        assert "Some paragraph text." in result
        assert "Subtitle" in result

    def test_extract_markdown_strips_frontmatter(self):
        md = b"---\ntitle: Test\nauthor: John\n---\n\n# Content\n\nActual text."
        result = extract_text(md, "text/markdown")
        assert "title: Test" not in result
        assert "Content" in result
        assert "Actual text." in result

    def test_extract_markdown_removes_code_fence_markers(self):
        md = b"# Doc\n\n```python\nprint('hello')\n```\n\nMore text."
        result = extract_text(md, "text/markdown")
        # The code content should be present but fence markers stripped
        assert "print" in result
        assert "More text." in result

    def test_extract_pdf(self):
        # Create a minimal valid PDF with text
        pdf_bytes = (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
            b"4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Hello PDF) Tj ET\nendstream\nendobj\n"
            b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
            b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n"
            b"0000000115 00000 n \n0000000270 00000 n \n0000000363 00000 n \n"
            b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n442\n%%EOF"
        )
        result = extract_text(pdf_bytes, "application/pdf")
        assert "Hello PDF" in result

    def test_unsupported_type_raises(self):
        with pytest.raises(ValueError, match="Unsupported file type"):
            extract_text(b"data", "application/octet-stream")

    def test_supported_types_defined(self):
        assert "application/pdf" in SUPPORTED_TYPES
        assert "text/plain" in SUPPORTED_TYPES
        assert "text/markdown" in SUPPORTED_TYPES
        assert "text/html" in SUPPORTED_TYPES
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in SUPPORTED_TYPES


class TestFileParserAPI:
    def test_ingest_with_base64_text_file(self, client, api_prefix):
        import base64 as b64
        text_content = "Hello world from a text file."
        encoded = b64.b64encode(text_content.encode()).decode()

        mock_embeddings = [[0.1, 0.2]]

        from unittest.mock import AsyncMock, patch

        with patch(
            "app.services.rag.embeddings.embedding_service.embed_batch",
            new_callable=AsyncMock,
            return_value=mock_embeddings,
        ):
            response = client.post(
                f"{api_prefix}/rag/ingest",
                json={
                    "document_id": "doc-parsed-1",
                    "filename": "test.txt",
                    "file_content": encoded,
                    "mime_type": "text/plain",
                    "chunk_size": 512,
                    "chunk_overlap": 64,
                },
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["document_id"] == "doc-parsed-1"
            assert data["total_chunks"] > 0
            assert data["extracted_text"]  # Should have extracted text

    def test_ingest_with_base64_html_file(self, client, api_prefix):
        import base64 as b64
        html_content = "<html><body><h1>Test</h1><p>Content here.</p></body></html>"
        encoded = b64.b64encode(html_content.encode()).decode()

        mock_embeddings = [[0.1, 0.2]]

        from unittest.mock import AsyncMock, patch

        with patch(
            "app.services.rag.embeddings.embedding_service.embed_batch",
            new_callable=AsyncMock,
            return_value=mock_embeddings,
        ):
            response = client.post(
                f"{api_prefix}/rag/ingest",
                json={
                    "document_id": "doc-html-1",
                    "filename": "page.html",
                    "file_content": encoded,
                    "mime_type": "text/html",
                    "chunk_size": 512,
                    "chunk_overlap": 64,
                },
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert "Test" in data["extracted_text"]
            assert "Content here." in data["extracted_text"]

    def test_ingest_with_base64_unsupported_type(self, client, api_prefix):
        import base64 as b64
        encoded = b64.b64encode(b"data").decode()

        response = client.post(
            f"{api_prefix}/rag/ingest",
            json={
                "document_id": "doc-bad",
                "filename": "file.bin",
                "file_content": encoded,
                "mime_type": "application/octet-stream",
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 400

import io
from pypdf import PdfReader
from docx import Document as DocxDocument
from bs4 import BeautifulSoup
import markdown


SUPPORTED_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/html",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def extract_text(content: bytes, mime_type: str) -> str:
    """Extract plain text from file bytes based on MIME type.

    Args:
        content: Raw file bytes
        mime_type: MIME type of the file

    Returns:
        Extracted plain text

    Raises:
        ValueError: If the MIME type is not supported
    """
    if mime_type not in SUPPORTED_TYPES:
        raise ValueError(f"Unsupported file type: {mime_type}")

    if mime_type == "application/pdf":
        return _extract_pdf(content)
    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _extract_docx(content)
    elif mime_type == "text/html":
        return _extract_html(content)
    elif mime_type == "text/markdown":
        return _extract_markdown(content)
    elif mime_type == "text/plain":
        return content.decode("utf-8", errors="replace")

    raise ValueError(f"No parser for: {mime_type}")


def _extract_pdf(content: bytes) -> str:
    """Extract text from PDF bytes using pypdf."""
    reader = PdfReader(io.BytesIO(content))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def _extract_docx(content: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    doc = DocxDocument(io.BytesIO(content))
    paragraphs = []
    for para in doc.paragraphs:
        if para.text.strip():
            paragraphs.append(para.text)
    return "\n\n".join(paragraphs)


def _extract_html(content: bytes) -> str:
    """Extract text from HTML bytes using BeautifulSoup."""
    text = content.decode("utf-8", errors="replace")
    soup = BeautifulSoup(text, "lxml")

    # Remove script and style elements
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    # Get text with paragraph separation
    lines = soup.get_text(separator="\n").split("\n")
    # Collapse whitespace and filter empty lines
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            cleaned.append(stripped)
    return "\n\n".join(cleaned)


def _extract_markdown(content: bytes) -> str:
    """Extract text from Markdown bytes.

    Converts markdown to HTML then strips tags to get plain text.
    Also preserves the raw markdown as a fallback since headings
    and structure are useful for chunking.
    """
    text = content.decode("utf-8", errors="replace")

    # Strip YAML frontmatter if present
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            text = parts[2].strip()

    # Convert to HTML then extract text for clean output
    html = markdown.markdown(text, extensions=["tables", "fenced_code"])
    soup = BeautifulSoup(html, "lxml")

    lines = soup.get_text(separator="\n").split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            cleaned.append(stripped)
    return "\n\n".join(cleaned)

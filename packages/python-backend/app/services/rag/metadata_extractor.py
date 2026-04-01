import json
from dataclasses import dataclass, field
from app.services.llm import llm_service


@dataclass
class DocumentMetadata:
    title: str = ""
    author: str = ""
    language: str = "en"
    topics: list[str] = field(default_factory=list)
    summary: str = ""
    document_type: str = ""


EXTRACTION_PROMPT = """Analyze the following document text and extract metadata. Return ONLY valid JSON with these fields:
- title: The document title (string, empty if unknown)
- author: The author name (string, empty if unknown)
- language: ISO 639-1 language code (e.g., "en", "es", "de")
- topics: Array of 3-7 key topics/themes (strings)
- summary: A 1-2 sentence summary of the document content
- document_type: One of: article, guide, report, legal, technical, marketing, other

Return ONLY the JSON object, no other text.

Document text (first 3000 characters):
{text}"""


async def extract_metadata(
    text: str,
    model: str | None = None,
) -> DocumentMetadata:
    """Extract structured metadata from document text using LLM."""
    # Truncate to first 3000 chars for metadata extraction
    sample = text[:3000]

    if not sample.strip():
        return DocumentMetadata()

    messages = [
        {
            "role": "user",
            "content": EXTRACTION_PROMPT.format(text=sample),
        }
    ]

    try:
        response = await llm_service.chat_complete(
            messages=messages,
            model=model,
            temperature=0.1,
        )

        content = response.get("message", {}).get("content", "")

        # Parse JSON from LLM response (may have markdown code fences)
        content = content.strip()
        if content.startswith("```"):
            content = "\n".join(content.split("\n")[1:])
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        data = json.loads(content)

        return DocumentMetadata(
            title=data.get("title", ""),
            author=data.get("author", ""),
            language=data.get("language", "en"),
            topics=data.get("topics", []),
            summary=data.get("summary", ""),
            document_type=data.get("document_type", "other"),
        )
    except (json.JSONDecodeError, KeyError, Exception):
        # Fallback: return minimal metadata
        return DocumentMetadata(
            title="",
            topics=[],
            language="en",
        )

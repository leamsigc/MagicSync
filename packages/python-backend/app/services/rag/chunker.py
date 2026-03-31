import re
import hashlib
from dataclasses import dataclass, field


@dataclass
class Chunk:
    content: str
    index: int
    token_count: int
    content_hash: str = ""
    metadata: dict = field(default_factory=dict)


def compute_content_hash(text: str) -> str:
    """Compute SHA-256 hash of text content for change detection."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English."""
    return max(1, len(text) // 4)


def chunk_text(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
    metadata: dict | None = None,
) -> list[Chunk]:
    """
    Split text into overlapping chunks by paragraphs/sentences.

    Strategy:
    1. Split by double newlines (paragraphs)
    2. Accumulate paragraphs until chunk_size tokens
    3. Keep overlap from previous chunk
    """
    if not text.strip():
        return []

    pages = [{"content": text, "metadata": metadata or {}}]
    return chunk_structured(pages, chunk_size, chunk_overlap)


def chunk_structured(
    pages: list[dict],
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[Chunk]:
    """
    Split structured pages into overlapping chunks, preserving page metadata.

    Args:
        pages: List of dicts with 'content', 'page_number', 'section_title', 'metadata' keys
        chunk_size: Target token count per chunk
        chunk_overlap: Token overlap between chunks
    """
    chunks: list[Chunk] = []
    chunk_index = 0

    for page in pages:
        text = page.get("content", "")
        if not text.strip():
            continue

        page_metadata = dict(page.get("metadata", {}))
        if page.get("page_number") is not None:
            page_metadata["page_number"] = page["page_number"]
        if page.get("section_title"):
            page_metadata["section_title"] = page["section_title"]

        paragraphs = re.split(r'\n\s*\n', text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        current_parts: list[str] = []
        current_tokens = 0

        for para in paragraphs:
            para_tokens = estimate_tokens(para)

            # If single paragraph exceeds chunk_size, split by sentences
            if para_tokens > chunk_size:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sentence in sentences:
                    sent_tokens = estimate_tokens(sentence)
                    if current_tokens + sent_tokens > chunk_size and current_parts:
                        chunk_content = '\n\n'.join(current_parts)
                        chunks.append(Chunk(
                            content=chunk_content,
                            index=chunk_index,
                            token_count=current_tokens,
                            content_hash=compute_content_hash(chunk_content),
                            metadata=page_metadata,
                        ))
                        chunk_index += 1

                        current_parts, current_tokens = _apply_overlap(
                            current_parts, chunk_overlap
                        )

                    current_parts.append(sentence)
                    current_tokens += sent_tokens
            else:
                if current_tokens + para_tokens > chunk_size and current_parts:
                    chunk_content = '\n\n'.join(current_parts)
                    chunks.append(Chunk(
                        content=chunk_content,
                        index=chunk_index,
                        token_count=current_tokens,
                        content_hash=compute_content_hash(chunk_content),
                        metadata=page_metadata,
                    ))
                    chunk_index += 1

                    current_parts, current_tokens = _apply_overlap(
                        current_parts, chunk_overlap
                    )

                current_parts.append(para)
                current_tokens += para_tokens

        # Final chunk for this page
        if current_parts:
            chunk_content = '\n\n'.join(current_parts)
            chunks.append(Chunk(
                content=chunk_content,
                index=chunk_index,
                token_count=current_tokens,
                content_hash=compute_content_hash(chunk_content),
                metadata=page_metadata,
            ))
            chunk_index += 1

    return chunks


def _apply_overlap(parts: list[str], chunk_overlap: int) -> tuple[list[str], int]:
    """Apply overlap by keeping the last part if it fits within overlap budget."""
    if chunk_overlap > 0 and parts:
        overlap_text = parts[-1]
        if estimate_tokens(overlap_text) <= chunk_overlap:
            return [overlap_text], estimate_tokens(overlap_text)
    return [], 0

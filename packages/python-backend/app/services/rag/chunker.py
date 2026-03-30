import re
from dataclasses import dataclass, field


@dataclass
class Chunk:
    content: str
    index: int
    token_count: int
    metadata: dict = field(default_factory=dict)


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

    paragraphs = re.split(r'\n\s*\n', text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks: list[Chunk] = []
    current_parts: list[str] = []
    current_tokens = 0
    chunk_index = 0

    for para in paragraphs:
        para_tokens = estimate_tokens(para)

        # If single paragraph exceeds chunk_size, split by sentences
        if para_tokens > chunk_size:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sentence in sentences:
                sent_tokens = estimate_tokens(sentence)
                if current_tokens + sent_tokens > chunk_size and current_parts:
                    chunk_text = '\n\n'.join(current_parts)
                    chunks.append(Chunk(
                        content=chunk_text,
                        index=chunk_index,
                        token_count=current_tokens,
                        metadata=metadata or {},
                    ))
                    chunk_index += 1

                    # Overlap: keep last part
                    if chunk_overlap > 0 and current_parts:
                        overlap_text = current_parts[-1]
                        if estimate_tokens(overlap_text) <= chunk_overlap:
                            current_parts = [overlap_text]
                            current_tokens = estimate_tokens(overlap_text)
                        else:
                            current_parts = []
                            current_tokens = 0
                    else:
                        current_parts = []
                        current_tokens = 0

                current_parts.append(sentence)
                current_tokens += sent_tokens
        else:
            if current_tokens + para_tokens > chunk_size and current_parts:
                chunk_text = '\n\n'.join(current_parts)
                chunks.append(Chunk(
                    content=chunk_text,
                    index=chunk_index,
                    token_count=current_tokens,
                    metadata=metadata or {},
                ))
                chunk_index += 1

                if chunk_overlap > 0 and current_parts:
                    overlap_text = current_parts[-1]
                    if estimate_tokens(overlap_text) <= chunk_overlap:
                        current_parts = [overlap_text]
                        current_tokens = estimate_tokens(overlap_text)
                    else:
                        current_parts = []
                        current_tokens = 0
                else:
                    current_parts = []
                    current_tokens = 0

            current_parts.append(para)
            current_tokens += para_tokens

    # Final chunk
    if current_parts:
        chunk_text = '\n\n'.join(current_parts)
        chunks.append(Chunk(
            content=chunk_text,
            index=chunk_index,
            token_count=current_tokens,
            metadata=metadata or {},
        ))

    return chunks

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    document_id: str
    filename: str = ""
    text: str = ""
    file_content: str = ""  # Base64-encoded file bytes (alternative to text)
    mime_type: str = ""  # Required when using file_content
    chunk_size: int = Field(default=512, ge=64, le=2048)
    chunk_overlap: int = Field(default=64, ge=0, le=512)
    embedding_model: str = "nomic-embed-text"


class ChunkResult(BaseModel):
    chunk_index: int
    content: str
    content_hash: str = ""
    token_count: int
    embedding: list[float]
    metadata: dict = {}


class IngestResponse(BaseModel):
    document_id: str
    chunks: list[ChunkResult]
    total_chunks: int
    extracted_text: str = ""


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)
    embedding_model: str = "nomic-embed-text"


class RetrieveResponse(BaseModel):
    query: str
    embedding: list[float]
    top_k: int


class ExtractMetadataRequest(BaseModel):
    text: str = ""
    file_content: str = ""  # Base64-encoded file bytes (alternative to text)
    mime_type: str = ""  # Required when using file_content
    model: str = ""


class ExtractMetadataResponse(BaseModel):
    title: str = ""
    author: str = ""
    language: str = "en"
    topics: list[str] = []
    summary: str = ""
    document_type: str = ""

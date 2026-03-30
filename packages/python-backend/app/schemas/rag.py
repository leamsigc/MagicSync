from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    document_id: str
    filename: str = ""
    text: str
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


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)
    embedding_model: str = "nomic-embed-text"


class RetrieveResponse(BaseModel):
    query: str
    embedding: list[float]
    top_k: int

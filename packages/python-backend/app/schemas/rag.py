from pydantic import BaseModel, Field, model_validator


class IngestRequest(BaseModel):
    document_id: str
    filename: str = ""
    text: str = ""
    file_content: str = ""  # Base64-encoded file bytes (alternative to text)
    mime_type: str = ""  # Required when using file_content
    chunk_size: int = Field(default=512, ge=64, le=2048)
    chunk_overlap: int = Field(default=64, ge=0, le=512)
    embedding_model: str = ""

    @model_validator(mode="after")
    def validate_content(self):
        if not self.text and not self.file_content:
            raise ValueError("Either 'text' or 'file_content' must be provided")
        if self.file_content and not self.mime_type:
            raise ValueError("'mime_type' is required when using 'file_content'")
        return self


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
    document_metadata: dict = {}


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)
    embedding_model: str = ""


class RetrieveResponse(BaseModel):
    query: str
    embedding: list[float]
    top_k: int


class ExtractMetadataRequest(BaseModel):
    text: str = ""
    file_content: str = ""  # Base64-encoded file bytes (alternative to text)
    mime_type: str = ""  # Required when using file_content
    model: str = ""

    @model_validator(mode="after")
    def validate_content(self):
        if not self.text and not self.file_content:
            raise ValueError("Either 'text' or 'file_content' must be provided")
        if self.file_content and not self.mime_type:
            raise ValueError("'mime_type' is required when using 'file_content'")
        return self


class ExtractMetadataResponse(BaseModel):
    title: str = ""
    author: str = ""
    language: str = "en"
    topics: list[str] = []
    summary: str = ""
    document_type: str = ""


class HybridSearchRequest(BaseModel):
    query: str
    query_embedding: list[float] = []
    top_k: int = Field(default=10, ge=1, le=50)
    document_id: str = ""
    metadata_key: str = ""
    metadata_value: str = ""
    use_rerank: bool = False
    rerank_model: str = "llama3.2"


class SearchResultItem(BaseModel):
    content: str
    document_id: str
    score: float
    rank: int
    metadata: dict = {}
    source: str = "hybrid"


class HybridSearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total_results: int
    reranked: bool = False

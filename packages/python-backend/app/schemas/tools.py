from pydantic import BaseModel, Field


class TextToSQLRequest(BaseModel):
    query: str
    schema_context: str = ""  # Optional: custom schema context
    model: str = ""


class TextToSQLResponse(BaseModel):
    query: str
    sql: str
    explanation: str = ""
    tables_used: list[str] = []


class TextToSQLExecuteRequest(BaseModel):
    sql: str
    max_rows: int = Field(default=100, ge=1, le=500)


class TextToSQLExecuteResponse(BaseModel):
    sql: str
    columns: list[str]
    rows: list[dict]
    row_count: int
    truncated: bool = False


class WebSearchRequest(BaseModel):
    query: str
    max_results: int = Field(default=5, ge=1, le=10)


class WebSearchResult(BaseModel):
    title: str
    url: str
    snippet: str


class WebSearchResponse(BaseModel):
    query: str
    results: list[WebSearchResult]
    total_results: int


# Knowledge Base Tool Schemas

class KbLsRequest(BaseModel):
    folder_path: str | None = None


class KbLsResponse(BaseModel):
    folder_path: str
    folders: list[dict]
    documents: list[dict]


class KbTreeRequest(BaseModel):
    folder_path: str | None = None


class KbTreeResponse(BaseModel):
    tree: dict


class KbGrepRequest(BaseModel):
    pattern: str
    folder_path: str | None = None
    limit: int = Field(default=10, ge=1, le=50)


class KbGrepResponse(BaseModel):
    pattern: str
    folder_path: str | None = None
    matches: list[dict]
    error: str | None = None


class KbGlobRequest(BaseModel):
    pattern: str


class KbGlobResponse(BaseModel):
    pattern: str
    matches: list[dict]
    error: str | None = None


class KbReadRequest(BaseModel):
    document_id: str


class KbReadResponse(BaseModel):
    document: dict | None
    chunks: list[dict]
    full_content: str
    error: str | None = None

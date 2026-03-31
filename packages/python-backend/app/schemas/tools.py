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

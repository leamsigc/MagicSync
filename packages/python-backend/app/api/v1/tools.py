import logging
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.tools import (
    TextToSQLRequest, TextToSQLResponse,
    TextToSQLExecuteRequest, TextToSQLExecuteResponse,
    WebSearchRequest, WebSearchResponse,
)
from app.services.tools import text_to_sql_service
from app.services.tools.web_search import web_search_service
from app.core.security import require_user, UserContext

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/text-to-sql", response_model=TextToSQLResponse)
async def generate_sql(
    request: TextToSQLRequest,
    user: UserContext = Depends(require_user),
):
    """Generate a SQL SELECT query from a natural language question."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")

    result = await text_to_sql_service.generate_sql(
        query=request.query,
        schema_context=request.schema_context,
        model=request.model or None,
    )

    return TextToSQLResponse(
        query=request.query,
        sql=result["sql"],
        explanation=result["explanation"],
        tables_used=result["tables_used"],
    )


@router.post("/text-to-sql/validate")
async def validate_sql(
    body: dict,
    user: UserContext = Depends(require_user),
):
    """Validate that a SQL query is safe to execute."""
    sql = body.get("sql", "")
    if not sql.strip():
        raise HTTPException(status_code=400, detail="SQL is required")

    is_valid, error = text_to_sql_service.validate_sql(sql)
    return {"valid": is_valid, "error": error, "sql": sql}


@router.post("/web-search", response_model=WebSearchResponse)
async def web_search(
    request: WebSearchRequest,
    user: UserContext = Depends(require_user),
):
    """Search the web using DuckDuckGo."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")

    result = await web_search_service.search(
        query=request.query,
        max_results=request.max_results,
    )

    return WebSearchResponse(**result)

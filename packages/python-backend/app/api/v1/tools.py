import logging
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.tools import (
    TextToSQLRequest, TextToSQLResponse,
    TextToSQLExecuteRequest, TextToSQLExecuteResponse,
    WebSearchRequest, WebSearchResponse,
    KbLsRequest, KbLsResponse,
    KbTreeRequest, KbTreeResponse,
    KbGrepRequest, KbGrepResponse,
    KbGlobRequest, KbGlobResponse,
    KbReadRequest, KbReadResponse,
)
from app.services.tools import text_to_sql_service
from app.services.tools.web_search import web_search_service
from app.services.tools.knowledge_base import KnowledgeBaseTools
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


@router.post("/kb-ls", response_model=KbLsResponse)
async def kb_ls(
    request: KbLsRequest,
    user: UserContext = Depends(require_user),
):
    """List documents and subfolders in a knowledge folder."""
    kb_tools = KnowledgeBaseTools(user.user_id)
    result = await kb_tools.kb_ls(folder_path=request.folder_path)
    return KbLsResponse(**result)


@router.post("/kb-tree", response_model=KbTreeResponse)
async def kb_tree(
    request: KbTreeRequest,
    user: UserContext = Depends(require_user),
):
    """Show full hierarchical tree of knowledge base."""
    kb_tools = KnowledgeBaseTools(user.user_id)
    result = await kb_tools.kb_tree(folder_path=request.folder_path)
    return KbTreeResponse(**result)


@router.post("/kb-grep", response_model=KbGrepResponse)
async def kb_grep(
    request: KbGrepRequest,
    user: UserContext = Depends(require_user),
):
    """Search for pattern within folder documents."""
    if not request.pattern.strip():
        raise HTTPException(status_code=400, detail="Pattern is required")

    kb_tools = KnowledgeBaseTools(user.user_id)
    result = await kb_tools.kb_grep(
        pattern=request.pattern,
        folder_path=request.folder_path,
        limit=request.limit,
    )
    return KbGrepResponse(**result)


@router.post("/kb-glob", response_model=KbGlobResponse)
async def kb_glob(
    request: KbGlobRequest,
    user: UserContext = Depends(require_user),
):
    """Find documents matching filename pattern."""
    if not request.pattern.strip():
        raise HTTPException(status_code=400, detail="Pattern is required")

    kb_tools = KnowledgeBaseTools(user.user_id)
    result = await kb_tools.kb_glob(pattern=request.pattern)
    return KbGlobResponse(**result)


@router.post("/kb-read", response_model=KbReadResponse)
async def kb_read(
    request: KbReadRequest,
    user: UserContext = Depends(require_user),
):
    """Read full content of a specific document."""
    if not request.document_id.strip():
        raise HTTPException(status_code=400, detail="Document ID is required")

    kb_tools = KnowledgeBaseTools(user.user_id)
    result = await kb_tools.kb_read(document_id=request.document_id)
    
    if "error" in result and result.get("document") is None:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return KbReadResponse(**result)

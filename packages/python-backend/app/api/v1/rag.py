from fastapi import APIRouter, Depends, HTTPException
import base64
import logging
from app.schemas.rag import (
    IngestRequest, IngestResponse, ChunkResult,
    RetrieveRequest, RetrieveResponse,
    ExtractMetadataRequest, ExtractMetadataResponse,
    HybridSearchRequest, HybridSearchResponse, SearchResultItem,
)
from app.services.rag import (
    embedding_service, chunk_text, chunk_structured,
    extract_structured, extract_metadata, reranker_service,
)
from app.core.security import require_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    request: IngestRequest,
    user: dict = Depends(require_user),
):
    """Chunk text and generate embeddings. Returns chunks with embeddings for the caller to store.

    Accepts either pre-extracted text or raw file bytes (base64) with a MIME type.
    Uses structured extraction to preserve page/section metadata.
    """
    document_metadata = {}

    # Extract text from file if file_content is provided
    if request.file_content and request.mime_type:
        try:
            file_bytes = base64.b64decode(request.file_content)
            parsed = extract_structured(file_bytes, request.mime_type)
            text = parsed.text
            document_metadata = parsed.metadata

            # Use structured pages for better chunking
            pages = [
                {
                    "content": page.content,
                    "page_number": page.page_number,
                    "section_title": page.section_title,
                    "metadata": {**page.metadata, "documentId": request.document_id, "source": request.filename},
                }
                for page in parsed.pages
            ]
            chunks = chunk_structured(
                pages=pages,
                chunk_size=request.chunk_size,
                chunk_overlap=request.chunk_overlap,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.exception(f"Failed to parse file for document {request.document_id}")
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")
    else:
        text = request.text
        chunks = chunk_text(
            text=text,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            metadata={"documentId": request.document_id, "source": request.filename},
        )

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text content is empty")

    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks generated from text")

    # Generate embeddings concurrently
    chunk_texts = [c.content for c in chunks]
    model = request.embedding_model or None  # Use default from settings if empty
    embeddings = await embedding_service.embed_batch(chunk_texts, model=model)

    results = []
    for chunk, embedding in zip(chunks, embeddings):
        results.append(ChunkResult(
            chunk_index=chunk.index,
            content=chunk.content,
            content_hash=chunk.content_hash,
            token_count=chunk.token_count,
            embedding=embedding,
            metadata=chunk.metadata,
        ))

    return IngestResponse(
        document_id=request.document_id,
        chunks=results,
        total_chunks=len(results),
        extracted_text=text[:5000],
        document_metadata=document_metadata,
    )


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(
    request: RetrieveRequest,
    user: dict = Depends(require_user),
):
    """Generate embedding for query and return it for the caller to search."""
    model = request.embedding_model or None
    embedding = await embedding_service.embed(request.query, model=model)

    return RetrieveResponse(
        query=request.query,
        embedding=embedding,
        top_k=request.top_k,
    )


@router.post("/extract-metadata", response_model=ExtractMetadataResponse)
async def extract_document_metadata(
    request: ExtractMetadataRequest,
    user: dict = Depends(require_user),
):
    """Extract structured metadata from document text using LLM."""
    if request.file_content and request.mime_type:
        try:
            file_bytes = base64.b64decode(request.file_content)
            parsed = extract_structured(file_bytes, request.mime_type)
            text = parsed.text
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")
    else:
        text = request.text

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text content is empty")

    model = request.model or None
    metadata = await extract_metadata(text, model=model)

    return ExtractMetadataResponse(
        title=metadata.title,
        author=metadata.author,
        language=metadata.language,
        topics=metadata.topics,
        summary=metadata.summary,
        document_type=metadata.document_type,
    )


@router.post("/hybrid-search", response_model=HybridSearchResponse)
async def hybrid_search(
    request: HybridSearchRequest,
    user: dict = Depends(require_user),
):
    """Perform hybrid search combining keyword and vector results with optional reranking.

    This endpoint returns the query embedding and search parameters for the caller
    (Nuxt server) to execute the actual search against Turso. If reranking is requested,
    it reranks the provided results.
    """
    if not request.query:
        raise HTTPException(status_code=400, detail="Query is required")

    # Generate query embedding if not provided
    query_embedding = request.query_embedding
    if not query_embedding:
        query_embedding = await embedding_service.embed(request.query)

    # If results are provided by the caller for reranking, rerank them
    if request.use_rerank:
        raise HTTPException(
            status_code=501,
            detail="Reranking should be performed by the caller. Send results to /rerank endpoint.",
        )

    # Return the embedding and search parameters for the caller to execute
    return HybridSearchResponse(
        query=request.query,
        results=[],
        total_results=0,
        reranked=False,
    )


@router.post("/rerank")
async def rerank(
    body: dict,
    user: dict = Depends(require_user),
):
    """Rerank search results using LLM-based reranking.

    Expects: { query: str, documents: [{content, document_id, score, metadata}], top_k: int }
    Returns: { results: [{content, document_id, score, rank, metadata}] }
    """
    query = body.get("query", "")
    documents = body.get("documents", [])
    top_k = body.get("top_k", 5)
    model = body.get("model", "llama3.2")

    if not query or not documents:
        raise HTTPException(status_code=400, detail="Query and documents are required")

    doc_texts = [d.get("content", "") for d in documents]
    reranked = await reranker_service.rerank(
        query=query,
        documents=doc_texts,
        model=model,
        top_k=top_k,
    )

    results = []
    for item in reranked:
        idx = item["index"]
        if idx < len(documents):
            original = documents[idx]
            results.append({
                "content": original.get("content", ""),
                "document_id": original.get("document_id", ""),
                "score": item["score"],
                "rank": len(results) + 1,
                "metadata": original.get("metadata", {}),
                "source": "reranked",
            })

    return {"results": results[:top_k], "total_results": len(results)}

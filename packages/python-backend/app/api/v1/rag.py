from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.schemas.rag import IngestRequest, IngestResponse, ChunkResult, RetrieveRequest, RetrieveResponse
from app.services.rag import embedding_service, chunk_text
from app.core.security import get_current_user

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    request: IngestRequest,
    user: dict = Depends(get_current_user),
):
    """Chunk text and generate embeddings. Returns chunks with embeddings for the caller to store."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text content is empty")

    # Chunk the text
    chunks = chunk_text(
        text=request.text,
        chunk_size=request.chunk_size,
        chunk_overlap=request.chunk_overlap,
        metadata={"documentId": request.document_id, "source": request.filename},
    )

    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks generated from text")

    # Generate embeddings
    chunk_texts = [c.content for c in chunks]
    embeddings = await embedding_service.embed_batch(
        chunk_texts, model=request.embedding_model
    )

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
    )


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(
    request: RetrieveRequest,
    user: dict = Depends(get_current_user),
):
    """Generate embedding for query and return it for the caller to search."""
    embedding = await embedding_service.embed(
        request.query, model=request.embedding_model
    )

    return RetrieveResponse(
        query=request.query,
        embedding=embedding,
        top_k=request.top_k,
    )

from fastapi import APIRouter, Depends, HTTPException
import base64
from app.schemas.rag import (
    IngestRequest, IngestResponse, ChunkResult,
    RetrieveRequest, RetrieveResponse,
    ExtractMetadataRequest, ExtractMetadataResponse,
)
from app.services.rag import embedding_service, chunk_text, extract_text, extract_metadata
from app.core.security import get_current_user

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    request: IngestRequest,
    user: dict = Depends(get_current_user),
):
    """Chunk text and generate embeddings. Returns chunks with embeddings for the caller to store.

    Accepts either pre-extracted text or raw file bytes (base64) with a MIME type.
    """
    # Extract text from file if file_content is provided
    if request.file_content and request.mime_type:
        try:
            file_bytes = base64.b64decode(request.file_content)
            text = extract_text(file_bytes, request.mime_type)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")
    else:
        text = request.text

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text content is empty")

    # Chunk the text
    chunks = chunk_text(
        text=text,
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
        extracted_text=text[:5000],  # Return first 5000 chars for metadata extraction
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


@router.post("/extract-metadata", response_model=ExtractMetadataResponse)
async def extract_document_metadata(
    request: ExtractMetadataRequest,
    user: dict = Depends(get_current_user),
):
    """Extract structured metadata from document text using LLM."""
    # Extract text from file if file_content is provided
    if request.file_content and request.mime_type:
        try:
            file_bytes = base64.b64decode(request.file_content)
            text = extract_text(file_bytes, request.mime_type)
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

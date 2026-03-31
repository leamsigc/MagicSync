import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import router as v1_router
from app.core.config import settings
from app.services.tracing.decorators import setup_langsmith

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_langsmith()
    logger.info("MagicSync AI Backend starting up")
    yield
    # Cleanup httpx clients
    from app.services.llm.ollama import ollama_service
    from app.services.rag.embeddings import embedding_service
    from app.services.rag.reranker import reranker_service
    from app.core.security import _auth_client

    for service, name in [
        (ollama_service, "ollama"),
        (embedding_service, "embeddings"),
        (reranker_service, "reranker"),
    ]:
        try:
            await service.close()
        except Exception as e:
            logger.warning(f"Failed to close {name} client: {e}")

    if _auth_client and not _auth_client.is_closed:
        try:
            await _auth_client.aclose()
        except Exception:
            pass

    logger.info("MagicSync AI Backend shutting down")


app = FastAPI(
    title=settings.app_name,
    description="FastAPI backend for MagicSync RAG and AI features",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")

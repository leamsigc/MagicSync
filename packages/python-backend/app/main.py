from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import router as v1_router
from app.core.config import settings
from app.services.tracing.decorators import setup_langsmith


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_langsmith()
    yield


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

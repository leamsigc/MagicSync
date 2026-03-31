from fastapi import APIRouter
from app.api.v1 import health, chat, rag, tools

router = APIRouter()

router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(chat.router, tags=["chat"])
router.include_router(rag.router, prefix="/rag", tags=["rag"])
router.include_router(tools.router, prefix="/tools", tags=["tools"])

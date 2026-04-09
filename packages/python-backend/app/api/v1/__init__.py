from fastapi import APIRouter
from app.api.v1 import health, chat, rag, tools, agent, skills, agent_extended

router = APIRouter()

router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(chat.router, tags=["chat"])
router.include_router(rag.router, prefix="/rag", tags=["rag"])
router.include_router(tools.router, prefix="/tools", tags=["tools"])
router.include_router(agent.router, prefix="/agent", tags=["agent"])
router.include_router(skills.router, prefix="/skills", tags=["skills"])
router.include_router(agent_extended.router, prefix="/agent-extended", tags=["agent-extended"])

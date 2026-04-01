from fastapi import APIRouter
from app.services.llm import llm_service
from app.schemas.health import HealthResponse, OllamaHealthResponse

router = APIRouter()


@router.get("", response_model=HealthResponse)
async def health_check():
    return {"status": "ok", "service": "magicsync-ai"}


@router.get("/llm", response_model=OllamaHealthResponse)
async def llm_health():
    """Check LLM service health (supports any configured provider)."""
    try:
        # Test with a simple completion
        response = await llm_service.chat_complete(
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=10,
        )
        return {"status": "ok", "provider": "configured"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

from fastapi import APIRouter
from app.services.llm import ollama_service
from app.schemas.health import HealthResponse, OllamaHealthResponse

router = APIRouter()


@router.get("", response_model=HealthResponse)
async def health_check():
    return {"status": "ok", "service": "magicsync-ai"}


@router.get("/ollama", response_model=OllamaHealthResponse)
async def ollama_health():
    try:
        models = await ollama_service.list_models()
        return {"status": "ok", "models": [m["name"] for m in models]}
    except Exception as e:
        return {"status": "error", "message": str(e)}

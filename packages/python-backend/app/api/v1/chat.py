from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse
from app.schemas.chat import ChatRequest, ChatResponse, StreamChunk
from app.services.llm import llm_service
from app.services.tracing.decorators import get_current_trace_url
from app.core.security import require_user, UserContext
from app.core.config import settings

router = APIRouter()


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    user: UserContext = Depends(require_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Use request body values if provided, otherwise use JWT config
    llm_config = user.llm_config
    provider = request.provider or llm_config.provider
    model = request.model or llm_config.model
    api_key = request.api_key or llm_config.api_key
    api_base = request.api_base or llm_config.api_base or (
        settings.ollama_base_url if provider == "ollama" else None
    )
    temperature = request.temperature if request.temperature is not None else llm_config.temperature
    max_tokens = request.max_tokens if request.max_tokens is not None else llm_config.max_tokens

    async def generate():
        async for chunk in llm_service.chat(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            provider=provider,
            api_key=api_key,
            api_base=api_base,
        ):
            yield f"data: {StreamChunk(content=chunk, done=False).model_dump_json()}\n\n"

        yield f"data: {StreamChunk(content='', done=True).model_dump_json()}\n\n"

    return EventSourceResponse(generate())


@router.post("/chat/complete", response_model=ChatResponse)
async def chat_complete(
    request: ChatRequest,
    user: UserContext = Depends(require_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Use request body values if provided, otherwise use JWT config
    llm_config = user.llm_config
    provider = request.provider or llm_config.provider
    model = request.model or llm_config.model
    api_key = request.api_key or llm_config.api_key
    api_base = request.api_base or llm_config.api_base or (
        settings.ollama_base_url if provider == "ollama" else None
    )
    temperature = request.temperature if request.temperature is not None else llm_config.temperature
    max_tokens = request.max_tokens if request.max_tokens is not None else llm_config.max_tokens

    response = await llm_service.chat_complete(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        provider=provider,
        api_key=api_key,
        api_base=api_base,
    )

    return ChatResponse(
        message={
            "role": response["message"]["role"],
            "content": response["message"]["content"],
        },
        model=response["model"],
        trace_url=get_current_trace_url(),
    )

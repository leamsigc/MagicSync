from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse
from app.schemas.chat import ChatRequest, ChatResponse, StreamChunk
from app.services.llm import ollama_service
from app.services.tracing.decorators import get_current_trace_url
from app.core.security import require_user

router = APIRouter()


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    user: dict = Depends(require_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def generate():
        async for chunk in ollama_service.chat(
            model=request.model,
            messages=messages,
            temperature=request.temperature,
        ):
            yield f"data: {StreamChunk(content=chunk, done=False).model_dump_json()}\n\n"

        yield f"data: {StreamChunk(content='', done=True).model_dump_json()}\n\n"

    return EventSourceResponse(generate())


@router.post("/chat/complete", response_model=ChatResponse)
async def chat_complete(
    request: ChatRequest,
    user: dict = Depends(require_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    response = await ollama_service.chat_complete(
        model=request.model,
        messages=messages,
        temperature=request.temperature,
    )

    return ChatResponse(
        message={
            "role": response["message"]["role"],
            "content": response["message"]["content"],
        },
        model=response["model"],
        trace_url=get_current_trace_url(),
    )

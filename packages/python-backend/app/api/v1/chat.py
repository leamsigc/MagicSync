from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse
from app.schemas.chat import ChatRequest, ChatResponse, StreamChunk
from app.schemas.health import OllamaHealthResponse
from app.services.llm import ollama_service
from app.services.tracing.decorators import get_current_trace_url
from app.core.security import get_current_user

router = APIRouter()


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    user: dict = Depends(get_current_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    
    # TODO: Store chat message in database with thread_id and user_id

    async def generate():
        full_content = ""
        async for chunk in ollama_service.chat(
            model=request.model,
            messages=messages,
            temperature=request.temperature,
        ):
            full_content += chunk
            yield f"data: {StreamChunk(content=chunk, done=False).model_dump_json()}\n\n"

        yield f"data: {StreamChunk(content='', done=True).model_dump_json()}\n\n"
        
        # TODO: Store assistant response in database

    return EventSourceResponse(generate())


@router.post("/chat/complete", response_model=ChatResponse)
async def chat_complete(
    request: ChatRequest,
    user: dict = Depends(get_current_user),
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

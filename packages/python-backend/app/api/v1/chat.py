from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse
from app.schemas.chat import ChatRequest, ChatResponse, StreamChunk
from app.services.llm import llm_service
from app.services.tracing.decorators import get_current_trace_url
from app.services.tools.executor import ToolExecutor, format_tool_result_for_context
from app.services.pii.pipeline import pii_pipeline
from app.core.security import require_user, UserContext
from app.core.config import settings

router = APIRouter()


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    user: UserContext = Depends(require_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Anonymize last user message before processing
    if request.messages:
        last_user_msg = next((m.content for m in reversed(request.messages) if m.role == "user"), None)
        if last_user_msg:
            anonymized_msg = await pii_pipeline.anonymize_input(last_user_msg, user.user_id)
            
            for i, m in enumerate(messages):
                if m["role"] == "user" and m["content"] == last_user_msg:
                    messages[i]["content"] = anonymized_msg
                    break
            
            # Detect and execute tools from original user message
            tool_executor = ToolExecutor(user.user_id)
            tool_result = await tool_executor.detect_and_execute(last_user_msg)
            
            if tool_result:
                context_msg = format_tool_result_for_context(tool_result)
                messages.append({
                    "role": "system",
                    "content": f"Tool executed: {tool_result['tool_name']}\n\n{context_msg}"
                })
                logger.info(f"Tool executed before chat: {tool_result['tool_name']}")

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

    output_buffer = []

    async def generate():
        nonlocal output_buffer
        async for chunk in llm_service.chat(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            provider=provider,
            api_key=api_key,
            api_base=api_base,
            user_id=user.user_id,
            thread_id=request.thread_id,
        ):
            output_buffer.append(chunk)
            yield f"data: {StreamChunk(content=chunk, done=False).model_dump_json()}\n\n"

        yield f"data: {StreamChunk(content='', done=True).model_dump_json()}\n\n"

    return EventSourceResponse(generate())


@router.post("/chat/complete", response_model=ChatResponse)
async def chat_complete(
    request: ChatRequest,
    user: UserContext = Depends(require_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Anonymize last user message before processing
    if request.messages:
        last_user_msg = next((m.content for m in reversed(request.messages) if m.role == "user"), None)
        if last_user_msg:
            anonymized_msg = await pii_pipeline.anonymize_input(last_user_msg, user.user_id)
            
            for i, m in enumerate(messages):
                if m["role"] == "user" and m["content"] == last_user_msg:
                    messages[i]["content"] = anonymized_msg
                    break
            
            # Detect and execute tools
            tool_executor = ToolExecutor(user.user_id)
            tool_result = await tool_executor.detect_and_execute(last_user_msg)
            
            if tool_result:
                context_msg = format_tool_result_for_context(tool_result)
                messages.append({
                    "role": "system",
                    "content": f"Tool executed: {tool_result['tool_name']}\n\n{context_msg}"
                })

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
        user_id=user.user_id,
        thread_id=request.thread_id,
    )

    # De-anonymize the response
    response_content = response["message"]["content"]
    de_anonymized = await pii_pipeline.de_anonymize_output(response_content, user.user_id)

    return ChatResponse(
        message={
            "role": response["message"]["role"],
            "content": de_anonymized,
        },
        model=response["model"],
        trace_url=get_current_trace_url(),
    )

import logging
import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse
from app.schemas.chat import ChatRequest, ChatResponse, StreamChunk
from app.services.llm import llm_service
from app.services.tracing.decorators import get_current_trace_url
from app.services.tools.manager import ToolManager, format_tool_result
from app.services.pii.pipeline import pii_pipeline
from app.core.security import require_user, UserContext
from app.core.config import settings
import litellm

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_TOOL_CALLS = 5


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    user: UserContext = Depends(require_user),
):
    logger.info(
        f"Chat request received - thread_id: {request.thread_id}, messages count: {len(request.messages)}"
    )
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    logger.info(f"Converted messages: {messages}")

    tool_manager = ToolManager(user.user_id)

    messages = await _prepare_messages(messages, user.user_id, tool_manager)

    llm_config = user.llm_config
    provider = request.provider or llm_config.provider
    model = request.model or llm_config.model
    api_key = request.api_key or llm_config.api_key
    api_base = (
        request.api_base
        or llm_config.api_base
        or (settings.ollama_base_url if provider == "ollama" else None)
    )
    temperature = (
        request.temperature
        if request.temperature is not None
        else llm_config.temperature
    )
    max_tokens = (
        request.max_tokens if request.max_tokens is not None else llm_config.max_tokens
    )

    litellm_model = _format_model(model, provider)
    tools = tool_manager.get_tool_definitions()

    output_buffer = []

    logger.info("Setting up generate function")

    def _parse_tool_call(content: str | None) -> dict | None:
        """Parse tool_call JSON from content (handles qwen3.5 quirk)."""
        if not content:
            return None
        content = content.strip()
        if not content.startswith("{"):
            return None
        try:
            parsed = json.loads(content)
            if "name" in parsed and "arguments" in parsed:
                return parsed
            return None
        except json.JSONDecodeError:
            return None

    def _is_valid_json_text(text: str) -> bool:
        """Check if text looks like valid human-readable text, not JSON."""
        if not text:
            return False
        text = text.strip()
        if text.startswith("{") or text.startswith("["):
            try:
                json.loads(text)
                return False
            except json.JSONDecodeError:
                pass
        if (
            text.startswith('"')
            or text.startswith("name")
            or text.startswith("arguments")
        ):
            return False
        return True

    async def generate():
        nonlocal output_buffer, messages

        logger.info("Starting generate function")
        tool_calls = []
        tool_call_count = 0

        while tool_call_count < MAX_TOOL_CALLS:
            extra_body = {}
            thinking_enabled = False  # Default disabled for cleaner tool calls
            if (
                provider == "ollama"
                and model
                and ("qwen" in model.lower() or "deepseek" in model.lower())
            ):
                thinking_enabled = False
                extra_body["think"] = False

            try:
                logger.info(
                    f"Calling LLM - model: {litellm_model}, messages: {len(messages)}"
                )
                response = await litellm.acompletion(
                    model=litellm_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    api_key=api_key,
                    api_base=api_base,
                    stream=True,
                    tools=tools if tools else None,
                    metadata={"user_id": user.user_id, "thread_id": request.thread_id},
                    extra_body=extra_body if extra_body else None,
                )
            except Exception as e:
                logger.error(f"LLM completion error: {e}")
                yield f"data: {StreamChunk(type='error', content=str(e), done=True).model_dump_json()}\n\n"
                return

            chunk_buffer = []
            tool_calls_response = None
            streamed_content = ""
            thinking_buffer = ""
            reasoning_id = None

            async for chunk in response:
                chunk_buffer.append(chunk)
                delta = chunk.choices[0].delta

                if delta:
                    reasoning_content = getattr(delta, "reasoning_content", None)
                    content = delta.content

                    if reasoning_content and thinking_enabled:
                        thinking_buffer += reasoning_content
                        if _is_valid_json_text(reasoning_content):
                            yield f"data: {StreamChunk(type='thinking', content=reasoning_content, done=False).model_dump_json()}\n\n"

                    if content:
                        streamed_content += content

                    if hasattr(delta, "tool_calls") and delta.tool_calls:
                        tool_calls_response = delta.tool_calls

            if not tool_calls_response:
                tool_call_data = _parse_tool_call(streamed_content)
                if not tool_call_data and thinking_buffer:
                    tool_call_data = _parse_tool_call(thinking_buffer)
                if tool_call_data:
                    logger.info(f"Detected tool_call: {tool_call_data.get('name')}")
                    tool_calls_response = [
                        type(
                            "ToolCall",
                            (),
                            {
                                "id": f"call_{tool_call_count}_{hash(streamed_content or thinking_buffer) % 10000}",
                                "function": type(
                                    "Function",
                                    (),
                                    {
                                        "name": tool_call_data["name"],
                                        "arguments": json.dumps(
                                            tool_call_data["arguments"]
                                        ),
                                    },
                                )(),
                            },
                        )()
                    ]
                    streamed_content = ""
                    thinking_buffer = ""

            tool_call_count += 1

            if not tool_calls_response:
                if streamed_content:
                    for i in range(0, len(streamed_content), 50):
                        chunk = streamed_content[i : i + 50]
                        yield f"data: {StreamChunk(type='text', content=chunk, done=False).model_dump_json()}\n\n"
                yield f"data: {StreamChunk(type='text', content='', done=True).model_dump_json()}\n\n"
                break

            for tc in tool_calls_response:
                func = tc.function
                logger.info(
                    f"Tool call: {func.name} with args: {func.arguments[:100] if func.arguments else 'none'}..."
                )

                yield f"data: {StreamChunk(type='tool_call', content='', tool_call={'id': tc.id, 'name': func.name, 'arguments': func.arguments}).model_dump_json()}\n\n"

                try:
                    args = (
                        json.loads(func.arguments)
                        if isinstance(func.arguments, str)
                        else func.arguments
                    )
                except json.JSONDecodeError:
                    args = {}

                result = await tool_manager.execute_tool(func.name, args)
                formatted_result = format_tool_result(func.name, result)

                yield f"data: {StreamChunk(type='tool_result', content=formatted_result, tool_result={'id': tc.id, 'result': formatted_result}).model_dump_json()}\n\n"

                # If tool result is the final output (not an error), format it as text for the user
                if not formatted_result.startswith('[Tool Error:'):
                    # Format tool result as readable text
                    try:
                        result_data = json.loads(formatted_result)
                        if isinstance(result_data, dict):
                            text_output = f"Generated {result_data.get('platform', 'post')} post:\n\n"
                            text_output += f"Text: {result_data.get('text', '')}\n"
                            text_output += f"Hashtags: {', '.join(result_data.get('hashtags', []))}"
                            yield f"data: {StreamChunk(type='text', content=text_output, done=False).model_dump_json()}\n\n"
                            # Output done and exit - skip further LLM calls
                            yield f"data: {StreamChunk(type='text', content='', done=True).model_dump_json()}\n\n"
                            return
                    except (json.JSONDecodeError, TypeError):
                        pass

                messages.append(
                    {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": func.name,
                                    "arguments": func.arguments,
                                },
                            }
                        ],
                    }
                )

                messages.append(
                    {"role": "tool", "tool_call_id": tc.id, "content": formatted_result}
                )

        yield f"data: {StreamChunk(type='text', content='', done=True).model_dump_json()}\n\n"

    return EventSourceResponse(generate())


@router.post("/chat/complete", response_model=ChatResponse)
async def chat_complete(
    request: ChatRequest,
    user: UserContext = Depends(require_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    tool_manager = ToolManager(user.user_id)

    messages = await _prepare_messages(messages, user.user_id, tool_manager)

    llm_config = user.llm_config
    provider = request.provider or llm_config.provider
    model = request.model or llm_config.model
    api_key = request.api_key or llm_config.api_key
    api_base = (
        request.api_base
        or llm_config.api_base
        or (settings.ollama_base_url if provider == "ollama" else None)
    )
    temperature = (
        request.temperature
        if request.temperature is not None
        else llm_config.temperature
    )
    max_tokens = (
        request.max_tokens if request.max_tokens is not None else llm_config.max_tokens
    )

    litellm_model = _format_model(model, provider)
    tools = tool_manager.get_tool_definitions()

    extra_body = {}
    if (
        provider == "ollama"
        and model
        and ("qwen" in model.lower() or "deepseek" in model.lower())
    ):
        extra_body["think"] = False

    tool_call_count = 0
    while tool_call_count < MAX_TOOL_CALLS:
        try:
            response = await litellm.acompletion(
                model=litellm_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=api_key,
                api_base=api_base,
                stream=False,
                tools=tools if tools else None,
                metadata={"user_id": user.user_id, "thread_id": request.thread_id},
                extra_body=extra_body if extra_body else None,
            )
        except Exception as e:
            logger.error(f"LLM completion error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        message = response.choices[0].message
        content = message.content

        if not content and hasattr(message, "tool_calls") and message.tool_calls:
            for tc in message.tool_calls:
                func = tc.function
                logger.info(f"Tool call: {func.name}")

                try:
                    args = (
                        json.loads(func.arguments)
                        if isinstance(func.arguments, str)
                        else func.arguments
                    )
                except json.JSONDecodeError:
                    args = {}

                result = await tool_manager.execute_tool(func.name, args)
                formatted_result = format_tool_result(func.name, result)

                messages.append(
                    {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": func.name,
                                    "arguments": func.arguments,
                                },
                            }
                        ],
                    }
                )

                messages.append(
                    {"role": "tool", "tool_call_id": tc.id, "content": formatted_result}
                )

            tool_call_count += 1
            continue

        break

    final_message = messages[-1] if messages else {"role": "assistant", "content": ""}
    response_content = final_message.get("content", "")

    de_anonymized = await pii_pipeline.de_anonymize_output(
        response_content, user.user_id
    )

    return ChatResponse(
        message={
            "role": "assistant",
            "content": de_anonymized,
        },
        model=response.model if hasattr(response, "model") else model,
        trace_url=get_current_trace_url(),
    )


async def _prepare_messages(
    messages: list, user_id: str, tool_manager: ToolManager
) -> list:
    """Prepare messages with PII anonymization."""
    if not messages:
        return messages

    last_user_msg = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"), None
    )
    if last_user_msg:
        anonymized_msg = await pii_pipeline.anonymize_input(last_user_msg, user_id)

        for i, m in enumerate(messages):
            if m.get("role") == "user" and m.get("content") == last_user_msg:
                messages[i]["content"] = anonymized_msg
                break

    return messages


def _format_model(model: str, provider: str) -> str:
    """Format model string for LiteLLM."""
    if "/" in model:
        return model

    provider_prefix_map = {
        "ollama": f"ollama/{model}",
        "openai": model,
        "anthropic": f"anthropic/{model}",
        "openrouter": f"openrouter/{model}",
        "google": f"google/{model}",
    }

    return provider_prefix_map.get(provider, model)

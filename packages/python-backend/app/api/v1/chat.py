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
MAX_FALLBACKS = 2


def _is_retryable_error(error: Exception) -> bool:
    """Determine if an error is retryable (connection, rate limit, auth, model not found)."""
    error_str = str(error).lower()
    error_type = type(error).__name__

    # Connection errors
    if any(
        keyword in error_str
        for keyword in [
            "connection",
            "timeout",
            "connect",
            "unreachable",
            "dns",
            "network",
        ]
    ):
        return True

    # Rate limiting (429)
    if "429" in error_str or "rate limit" in error_str:
        return True

    # Authentication errors (401, 403)
    if any(keyword in error_str for keyword in ["401", "403", "unauthorized", "forbidden", "invalid api key", "api key"]):
        return True

    # Model not found / not supported
    if any(
        keyword in error_str
        for keyword in [
            "model not found",
            "not found",
            "does not support",
            "not supported",
            "invalid model",
            "unknown model",
        ]
    ):
        return True

    # litellm specific errors
    if error_type in ["AuthenticationError", "RateLimitError", "TimeoutError"]:
        return True

    return False


def _format_fallback_provider_config(
    fallback_provider: dict,
) -> tuple[str, str, str | None, str | None]:
    """Extract fallback provider config: (provider, model, api_key, api_base)."""
    fb_provider = fallback_provider.get("provider", "ollama")
    fb_model = fallback_provider.get("model", settings.ollama_default_model)
    fb_api_key = fallback_provider.get("api_key")
    fb_api_base = fallback_provider.get("api_base")

    # Use default Ollama config if provider is ollama
    if fb_provider == "ollama":
        fb_api_base = fb_api_base or settings.ollama_base_url
        fb_model = fb_model or settings.ollama_default_model

    return fb_provider, fb_model, fb_api_key, fb_api_base


async def try_fallback_chain(
    messages: list,
    tools: list,
    primary_provider: str,
    primary_model: str,
    primary_api_key: str | None,
    primary_api_base: str | None,
    temperature: float,
    max_tokens: int,
    user_id: str,
    thread_id: str | None,
    enable_thinking: bool,
    fallback_providers: list | None = None,
    stream: bool = True,
):
    """
    Try LLM completion with fallback chain.

    Args:
        messages: Chat messages
        tools: Tool definitions
        primary_provider: Primary LLM provider
        primary_model: Primary model name
        primary_api_key: API key for primary provider
        primary_api_base: API base URL for primary provider
        temperature: Temperature setting
        max_tokens: Max tokens setting
        user_id: User ID for metadata
        thread_id: Thread ID for metadata
        enable_thinking: Whether to enable thinking (for ollama qwen/deepseek)
        fallback_providers: List of fallback configs [{"provider": "...", "model": "...", ...}]
        stream: Whether to stream response

    Yields:
        Stream chunks or returns response object

    Returns:
        Tuple of (response, used_fallback_provider_name or None)
    """
    # Build the provider chain: primary + fallbacks (max 2 total)
    provider_configs = [
        {
            "provider": primary_provider,
            "model": primary_model,
            "api_key": primary_api_key,
            "api_base": primary_api_base,
            "is_primary": True,
        }
    ]

    if fallback_providers:
        for fb in fallback_providers[:MAX_FALLBACKS]:
            provider, model, api_key, api_base = _format_fallback_provider_config(fb)
            provider_configs.append(
                {
                    "provider": provider,
                    "model": model,
                    "api_key": api_key,
                    "api_base": api_base,
                    "is_primary": False,
                }
            )

    last_error = None
    used_fallback = None

    for i, config in enumerate(provider_configs):
        provider = config["provider"]
        model = config["model"]
        api_key = config["api_key"]
        api_base = config["api_base"]
        is_primary = config["is_primary"]

        litellm_model = _format_model(model, provider)

        extra_body = {}
        if provider == "ollama" and model and ("qwen" in model.lower() or "deepseek" in model.lower()):
            extra_body["think"] = enable_thinking

        log_prefix = "Primary" if is_primary else f"Fallback {i}"
        logger.info(
            f"{log_prefix} LLM attempt - provider: {provider}, model: {litellm_model}"
        )

        try:
            response = await litellm.acompletion(
                model=litellm_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=api_key,
                api_base=api_base,
                stream=stream,
                tools=tools if tools else None,
                metadata={"user_id": user_id, "thread_id": thread_id},
                extra_body=extra_body if extra_body else None,
            )

            if not is_primary:
                used_fallback = f"{provider}/{model}"
                logger.warning(
                    f"Primary LLM failed, using fallback: {used_fallback}"
                )

            return response, used_fallback

        except Exception as e:
            last_error = e

            if _is_retryable_error(e):
                if is_primary:
                    logger.warning(
                        f"Primary LLM failed ({type(e).__name__}: {str(e)[:100]}), trying fallback chain..."
                    )
                else:
                    logger.warning(
                        f"Fallback {provider}/{model} failed ({type(e).__name__}: {str(e)[:100]}), trying next..."
                    )
                continue
            else:
                # Non-retryable error, don't try fallbacks
                logger.error(f"Non-retryable LLM error: {type(e).__name__}: {str(e)[:200]}")
                raise

    # All providers failed
    error_msg = f"All LLM providers failed. Last error: {last_error}"
    logger.error(error_msg)
    raise Exception(error_msg)


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

    # Only enable tools if explicitly requested (default True for backwards compatibility)
    enable_tools = getattr(request, 'enable_tools', True)
    tools = tool_manager.get_tool_definitions() if enable_tools else []

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

    def _format_tool_result_as_text(tool_name: str, formatted_result: str) -> str | None:
        """Format tool result as readable text for the user."""
        logger.info(f"_format_tool_result_as_text called for {tool_name}")
        logger.info(f"formatted_result: {formatted_result[:300]}...")
        
        try:
            result_data = json.loads(formatted_result)
            logger.info(f"result_data keys: {result_data.keys()}")
            if not isinstance(result_data, dict):
                return None
            
            # Handle generate_twitter_post and generate_social_post
            if tool_name in ('generate_twitter_post', 'generate_social_post') and 'text' in result_data:
                text_output = f"Generated {result_data.get('platform', 'post')} post:\n\n"
                text_output += f"Text: {result_data.get('text', '')}\n"
                if result_data.get('hashtags'):
                    text_output += f"Hashtags: {', '.join(result_data.get('hashtags', []))}"
                if result_data.get('warning'):
                    text_output += f"\n⚠️ {result_data.get('warning')}"
                return text_output
            
            # Handle generate_thread
            if tool_name == 'generate_thread' and 'thread' in result_data:
                thread = result_data.get('thread', [])
                text_output = f"Generated thread ({len(thread)} tweets):\n\n"
                for i, tweet in enumerate(thread, 1):
                    text_output += f"Tweet {i}: {tweet.get('text', '')}\n"
                    if tweet.get('hashtags'):
                        text_output += f"  Hashtags: {', '.join(tweet.get('hashtags', []))}\n"
                    text_output += "\n"
                return text_output
            
            # Handle execute_code
            if tool_name == 'execute_code' and 'output' in result_data:
                output = result_data.get('output', '(no output)')
                error = result_data.get('error')
                status = result_data.get('status', 'unknown')
                
                # Check for "(no output)" - the code ran but produced no visible output
                # This often happens when user writes "2+2" instead of "print(2+2)"
                isNoOutput = output == '(no output)' and not error
                
                # Only treat as error if error key has actual value
                if error:
                    return f"[Code Execution Error]\n{error}"
                elif status == 'disabled':
                    return f"[Code Execution Disabled]\n{result_data.get('code', 'Code execution is disabled')}"
                elif isNoOutput:
                    # Add helpful hint about print()
                    return f"[Code Execution Result]\n(No output returned)\n\n💡 Hint: Use print() to output results, e.g., `print(2 + 2 + 4)`"
                else:
                    return f"[Code Execution Result]\n{output}"
            
            # Handle retrieve/hybrid_search
            if tool_name in ('retrieve', 'hybrid_search') and 'results' in result_data:
                results = result_data.get('results', [])
                if results:
                    lines = ["[Search Results]\n"]
                    for i, r in enumerate(results[:5], 1):
                        content = r.get('content', '')[:200]
                        lines.append(f"{i}. {content}...")
                    return '\n'.join(lines)
            
            # Handle web_search
            if tool_name == 'web_search':
                logger.info(f"Processing web_search result, keys: {result_data.keys()}")
                # Check for error (including rate limiting)
                error = result_data.get('error')
                if error:
                    return f"[Web Search Error]\n{error}\n\n💡 Tip: Wait a few seconds and try again."
                results = result_data.get('results', [])
                source = result_data.get('source', 'unknown')
                logger.info(f"Web search results count: {len(results)}, source: {source}")
                if results:
                    source_label = f" (via {source})" if source != 'unknown' else ""
                    lines = [f"[Web Search Results]{source_label}\n"]
                    for i, r in enumerate(results, 1):
                        title = r.get('title', 'No title')
                        url = r.get('url', '')
                        snippet = r.get('snippet', '')[:150]
                        lines.append(f"{i}. {title}")
                        lines.append(f"   {snippet}")
                        if url:
                            lines.append(f"   🔗 {url}")
                        lines.append("")
                    return '\n'.join(lines)
                # Return something even when no results
                return "[Web Search] No results found for query"
            
            # Default: return JSON as formatted text for other tools
            return f"[{tool_name} Result]\n{json.dumps(result_data, indent=2)[:500]}"
            
        except (json.JSONDecodeError, TypeError):
            return None

    async def generate():
        nonlocal output_buffer, messages

        logger.info("Starting generate function")
        tool_calls = []
        tool_call_count = 0

        # Get fallback providers from request or user config
        fallback_providers = request.provider_fallback or llm_config.provider_fallback

        while tool_call_count < MAX_TOOL_CALLS:
            thinking_enabled = False  # Default disabled for cleaner tool calls
            if (
                provider == "ollama"
                and model
                and ("qwen" in model.lower() or "deepseek" in model.lower())
            ):
                thinking_enabled = False

            try:
                # Use fallback chain for LLM calls
                response, used_fallback = await try_fallback_chain(
                    messages=messages,
                    tools=tools,
                    primary_provider=provider,
                    primary_model=model,
                    primary_api_key=api_key,
                    primary_api_base=api_base,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    user_id=user.user_id,
                    thread_id=request.thread_id,
                    enable_thinking=thinking_enabled,
                    fallback_providers=fallback_providers,
                    stream=True,
                )
                if used_fallback:
                    logger.info(f"Using fallback provider: {used_fallback}")
            except Exception as llm_error:
                logger.error(f"LLM completion error: {llm_error}")
                yield f"data: {StreamChunk(type='error', content=str(llm_error), done=True).model_dump_json()}\n\n"
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

                logger.info(f"Tool {func.name} result: {formatted_result[:200]}...")
                yield f"data: {StreamChunk(type='tool_result', content=formatted_result, tool_result={'id': tc.id, 'result': formatted_result}).model_dump_json()}\n\n"

                # If tool result is successful (not an error), format it as text for the user and END the stream
                if not formatted_result.startswith('[Tool Error:'):
                    text_output = _format_tool_result_as_text(func.name, formatted_result)
                    logger.info(f"Formatted text output: {text_output[:200] if text_output else 'None'}...")
                    if text_output:
                        yield f"data: {StreamChunk(type='text', content=text_output, done=False).model_dump_json()}\n\n"
                        yield f"data: {StreamChunk(type='text', content='', done=True).model_dump_json()}\n\n"
                        logger.info(f"Tool {func.name} executed, returning final response")
                        return  # EXIT - don't make more LLM calls
                    else:
                        # Fallback: return the raw tool result
                        logger.warning(f"Formatting returned None for {func.name}, using fallback")
                        fallback_text = f"[{func.name} Result]\n{formatted_result}"
                        yield f"data: {StreamChunk(type='text', content=fallback_text, done=False).model_dump_json()}\n\n"
                        yield f"data: {StreamChunk(type='text', content='', done=True).model_dump_json()}\n\n"
                        return

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

    tools = tool_manager.get_tool_definitions()

    # Get fallback providers from request or user config
    fallback_providers = request.provider_fallback or llm_config.provider_fallback

    enable_thinking = False
    if (
        provider == "ollama"
        and model
        and ("qwen" in model.lower() or "deepseek" in model.lower())
    ):
        enable_thinking = False

    tool_call_count = 0
    while tool_call_count < MAX_TOOL_CALLS:
        try:
            # Use fallback chain for LLM calls
            response, used_fallback = await try_fallback_chain(
                messages=messages,
                tools=tools,
                primary_provider=provider,
                primary_model=model,
                primary_api_key=api_key,
                primary_api_base=api_base,
                temperature=temperature,
                max_tokens=max_tokens,
                user_id=user.user_id,
                thread_id=request.thread_id,
                enable_thinking=enable_thinking,
                fallback_providers=fallback_providers,
                stream=False,
            )
            if used_fallback:
                logger.info(f"Using fallback provider: {used_fallback}")
        except Exception as llm_error:
            logger.error(f"LLM completion error: {llm_error}")
            raise HTTPException(status_code=500, detail=str(llm_error))

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

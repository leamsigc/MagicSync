from pydantic import BaseModel, Field
from typing import Literal, Any


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(default_factory=list)
    model: str = "gemini-3-flash-preview"
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0, le=8192)
    thread_id: str | None = None
    provider: str | None = None  # ollama, openai, anthropic, openrouter
    api_key: str | None = None
    api_base: str | None = None
    enable_tools: bool = True  # Enable/disable function calling
    provider_fallback: list | None = None  # List of fallback providers [{"provider": "ollama", "model": "qwen3.5"}]
    business_context: str | None = None  # Opt-in Digital Home brand_context grounding
    business_id: str | None = None  # Business scope (verified Nuxt-side via membership)
    use_business_context: bool = False  # Explicit opt-in flag
    context_edition_id: str | None = None  # Resolved playbook edition (traceability)


class ChatResponse(BaseModel):
    message: Message
    model: str
    trace_url: str | None = None


class StreamChunk(BaseModel):
    type: str = "text"  # text, thinking, tool_call, tool_result
    content: str = ""
    done: bool = False
    tool_call: dict | None = None
    tool_result: dict | None = None


class ChatHistoryItem(BaseModel):
    id: str
    role: str
    content: str
    created_at: str

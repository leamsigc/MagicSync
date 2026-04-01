from pydantic import BaseModel, Field
from typing import Literal


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(default_factory=list)
    model: str = "qwen3.5"
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0, le=8192)
    thread_id: str | None = None
    # LLM provider config (optional, overrides headers)
    provider: str | None = None  # ollama, openai, anthropic, openrouter
    api_key: str | None = None
    api_base: str | None = None


class ChatResponse(BaseModel):
    message: Message
    model: str
    trace_url: str | None = None


class StreamChunk(BaseModel):
    content: str
    done: bool = False


class ChatHistoryItem(BaseModel):
    id: str
    role: str
    content: str
    created_at: str

from pydantic import BaseModel, Field
from typing import Literal


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(default_factory=list)
    model: str = "llama3.2"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, gt=0)
    thread_id: str | None = None


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

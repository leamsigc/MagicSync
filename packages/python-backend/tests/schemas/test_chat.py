import pytest
from app.schemas.chat import ChatRequest, Message, StreamChunk, ChatResponse


class TestChatSchemas:
    def test_message_schema(self):
        msg = Message(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"

    def test_chat_request_defaults(self):
        req = ChatRequest(messages=[])
        assert req.messages == []
        assert req.model == "qwen3.5"
        assert req.temperature is None
        assert req.max_tokens is None
        assert req.thread_id is None

    def test_chat_request_custom_values(self):
        req = ChatRequest(
            messages=[Message(role="user", content="Hello")],
            model="custom-model",
            temperature=0.5,
            max_tokens=1000,
            thread_id="abc123",
        )
        assert len(req.messages) == 1
        assert req.model == "custom-model"
        assert req.temperature == 0.5
        assert req.max_tokens == 1000
        assert req.thread_id == "abc123"

    def test_stream_chunk_schema(self):
        chunk = StreamChunk(content="Hello", done=False)
        assert chunk.content == "Hello"
        assert chunk.done is False

    def test_stream_chunk_done(self):
        chunk = StreamChunk(content="", done=True)
        assert chunk.content == ""
        assert chunk.done is True

    def test_chat_response_schema(self):
        resp = ChatResponse(
            message=Message(role="assistant", content="Hello"),
            model="qwen3.5",
            trace_url="https://example.com",
        )
        assert resp.message.role == "assistant"
        assert resp.message.content == "Hello"
        assert resp.model == "qwen3.5"
        assert resp.trace_url == "https://example.com"

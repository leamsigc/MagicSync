import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False
    logger.warning("tiktoken not available - token counting will be estimated")

MODEL_CONTEXT_WINDOWS = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-turbo": 128000,
    "gpt-4": 8192,
    "gpt-3.5-turbo": 16385,
    "claude-3-opus": 200000,
    "claude-3-sonnet": 200000,
    "claude-3-haiku": 200000,
    "claude-3-5-sonnet": 200000,
    "claude-3-5-sonnet-20241022": 200000,
    "claude-sonnet-4-20250514": 200000,
    "llama-3": 8192,
    "llama-3.1": 128000,
    "llama-3.2": 128000,
    "qwen2.5": 32768,
    "qwen2": 32768,
    "mistral": 32000,
    "mixtral": 32000,
    "default": 128000,
}

SUPPORTED_MODELS = set(MODEL_CONTEXT_WINDOWS.keys()) - {"default"}


def validate_model(model: str) -> tuple[bool, str]:
    """Validate if model is supported. Returns (is_valid, message)."""
    if model in SUPPORTED_MODELS:
        return True, "supported"
    
    if model in MODEL_CONTEXT_WINDOWS:
        return True, "using default context window"
    
    return False, f"unknown model, using default context window ({MODEL_CONTEXT_WINDOWS['default']} tokens)"


def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """Count tokens in text using tiktoken."""
    if not TIKTOKEN_AVAILABLE:
        return len(text) // 4
    
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))


def get_context_window(model: str) -> int:
    """Get context window size for a model."""
    is_valid, message = validate_model(model)
    if not is_valid:
        logger.warning(f"Token counter: {message} for model '{model}'")
    return MODEL_CONTEXT_WINDOWS.get(model, MODEL_CONTEXT_WINDOWS["default"])


def calculate_context_usage(
    messages: list[dict],
    max_tokens: Optional[int] = None,
    model: str = "gpt-4o"
) -> dict:
    """Calculate context window usage from messages."""
    if max_tokens is None:
        max_tokens = get_context_window(model)
    
    total_tokens = 0
    message_counts = []
    
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, list):
            content = " ".join(
                c.get("text", "") for c in content if c.get("type") == "text"
            )
        
        tokens = count_tokens(content, model)
        message_counts.append(tokens)
        total_tokens += tokens
    
    percentage = (total_tokens / max_tokens * 100) if max_tokens > 0 else 0
    
    return {
        "used": total_tokens,
        "max": max_tokens,
        "remaining": max_tokens - total_tokens,
        "percentage": round(percentage, 1),
        "status": "green" if percentage < 50 else "yellow" if percentage < 80 else "red",
        "message_counts": message_counts
    }


def estimate_tokens(text: str) -> int:
    """Estimate tokens without tiktoken (fallback)."""
    return len(text) // 4

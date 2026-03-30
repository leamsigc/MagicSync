import os
import logging
from functools import wraps
from typing import Callable, Any

logger = logging.getLogger(__name__)

_langsmith_client = None
_langsmith_configured = False


def setup_langsmith() -> None:
    global _langsmith_client, _langsmith_configured
    
    api_key = os.getenv("LANGSMITH_API_KEY")
    project = os.getenv("LANGSMITH_PROJECT", "magicsync-ai")

    if api_key:
        try:
            from langsmith import Client
            _langsmith_client = Client(api_key=api_key, project=project)
            os.environ["LANGSMITH_TRACING"] = "true"
            os.environ["LANGSMITH_PROJECT"] = project
            _langsmith_configured = True
            logger.info(f"LangSmith configured for project: {project}")
        except ImportError:
            logger.warning("LangSmith not installed, tracing disabled")


def traceable(project_name: str = "magicsync-ai") -> Callable:
    """
    Decorator for tracing functions with LangSmith.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            if _langsmith_configured:
                from langsmith import traceable as _traceable
                traced = _traceable(project_name=project_name)
                return await traced(func)(*args, **kwargs)
            return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            if _langsmith_configured:
                from langsmith import traceable as _traceable
                traced = _traceable(project_name=project_name)
                return traced(func)(*args, **kwargs)
            return func(*args, **kwargs)
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def get_current_trace_url() -> str | None:
    """
    Get the current trace URL from LangSmith.
    """
    if not _langsmith_configured or not _langsmith_client:
        return None
    
    # LangSmith doesn't expose current run directly in the public API
    # Return a URL to the project instead
    project = os.getenv("LANGSMITH_PROJECT", "magicsync-ai")
    return f"https://smith.langchain.com/projects/{project}"

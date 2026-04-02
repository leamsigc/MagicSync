import json
import logging
from typing import Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict
    category: str = "general"
    tags: list[str] = field(default_factory=list)
    usage_count: int = 0


class ToolRegistry:
    """Dynamic tool registry with on-demand loading and search."""

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}
        self._categories: dict[str, list[str]] = {}
        self._initialize_default_tools()

    def _initialize_default_tools(self):
        """Initialize built-in tools."""
        from app.services.tools.knowledge_base import KB_TOOLS
        from app.services.skills.tools import SKILL_TOOLS
        
        all_tools = [
            *KB_TOOLS,
            *SKILL_TOOLS,
        ]
        
        for tool in all_tools:
            self.register(
                name=tool.get("name", ""),
                description=tool.get("description", ""),
                parameters=tool.get("parameters", {}),
                category="ai_tools",
                tags=["ai", "knowledge"]
            )

    def register(
        self,
        name: str,
        description: str,
        parameters: dict,
        category: str = "general",
        tags: list[str] = None
    ):
        """Register a tool in the registry."""
        tool_def = ToolDefinition(
            name=name,
            description=description,
            parameters=parameters,
            category=category,
            tags=tags or []
        )
        
        self._tools[name] = tool_def
        
        if category not in self._categories:
            self._categories[category] = []
        if name not in self._categories[category]:
            self._categories[category].append(name)

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        """Get tool definition by name."""
        tool = self._tools.get(name)
        if tool:
            tool.usage_count += 1
        return tool

    def search(self, query: str, limit: int = 5) -> list[ToolDefinition]:
        """Search tools by keyword or regex."""
        query_lower = query.lower()
        results = []
        
        for tool in self._tools.values():
            score = 0
            
            if query_lower in tool.name.lower():
                score += 10
            if query_lower in tool.description.lower():
                score += 5
            if any(query_lower in tag.lower() for tag in tool.tags):
                score += 3
            
            if score > 0:
                results.append((score, tool))
        
        results.sort(key=lambda x: x[0], reverse=True)
        return [t for _, t in results[:limit]]

    def get_catalog(self, max_tokens: int = 500) -> str:
        """Get compact tool catalog for system prompt."""
        lines = ["Available Tools:"]
        
        for name, tool in self._tools.items():
            lines.append(f"- {name}: {tool.description[:80]}")
        
        return "\n".join(lines[:20])

    def get_by_category(self, category: str) -> list[ToolDefinition]:
        """Get all tools in a category."""
        tool_names = self._categories.get(category, [])
        return [self._tools[name] for name in tool_names if name in self._tools]

    def get_usage_stats(self) -> dict:
        """Get tool usage statistics."""
        sorted_tools = sorted(
            self._tools.values(),
            key=lambda t: t.usage_count,
            reverse=True
        )
        return {
            "total_tools": len(self._tools),
            "top_tools": [
                {"name": t.name, "usage": t.usage_count}
                for t in sorted_tools[:10]
            ]
        }

    def to_openai_format(self) -> list[dict]:
        """Convert to OpenAI function calling format."""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters
                }
            }
            for tool in self._tools.values()
        ]


tool_registry = ToolRegistry()


class ToolSearchTool:
    """tool_search for LLM function calling."""

    @staticmethod
    def search(query: str, limit: int = 5) -> dict:
        """Search for tools matching query."""
        results = tool_registry.search(query, limit)
        
        return {
            "query": query,
            "results": [
                {
                    "name": t.name,
                    "description": t.description,
                    "category": t.category,
                    "tags": t.tags
                }
                for t in results
            ],
            "count": len(results)
        }

    @staticmethod
    def get_catalog() -> str:
        """Get compact tool catalog."""
        return tool_registry.get_catalog()

    @staticmethod
    def load_tool(name: str) -> dict:
        """Load full tool schema by name."""
        tool = tool_registry.get_tool(name)
        
        if not tool:
            return {"error": f"Tool '{name}' not found"}
        
        return {
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.parameters,
            "category": tool.category,
            "tags": tool.tags
        }


TOOL_SEARCH_TOOLS = [
    {
        "name": "tool_search",
        "description": "Search for available tools by keyword. Use when you need to find a specific tool or discover what tools exist for a task.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query (keyword or description)"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results",
                    "default": 5
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "load_tool",
        "description": "Load full schema and details of a specific tool by name. Use after tool_search to get complete tool parameters.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the tool to load"
                }
            },
            "required": ["name"]
        }
    },
    {
        "name": "get_tool_catalog",
        "description": "Get compact list of all available tools for the current session.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
]
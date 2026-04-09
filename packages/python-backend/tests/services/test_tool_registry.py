import pytest
from app.services.tools.registry import (
    ToolRegistry,
    ToolDefinition,
    tool_registry,
    generate_tool_stubs,
    TOOL_SEARCH_TOOLS
)


class TestToolRegistry:
    """Tests for dynamic tool registry."""

    def test_registry_initialized(self):
        """Verify registry has default tools."""
        assert tool_registry is not None
        assert len(tool_registry._tools) > 0

    def test_register_tool(self):
        """Test tool registration."""
        registry = ToolRegistry()
        
        registry.register(
            name="test_tool",
            description="Test tool description",
            parameters={"type": "object", "properties": {}},
            category="test",
            tags=["test"]
        )
        
        tool = registry.get_tool("test_tool")
        assert tool is not None
        assert tool.name == "test_tool"
        assert tool.description == "Test tool description"
        assert "test" in tool.tags

    def test_search_tools(self):
        """Test tool search by keyword."""
        results = tool_registry.search("knowledge", limit=5)
        assert len(results) > 0

    def test_search_by_name(self):
        """Test exact name search."""
        results = tool_registry.search("kb_ls", limit=3)
        assert len(results) > 0
        assert any(t.name == "kb_ls" for t in results)

    def test_get_catalog(self):
        """Test compact catalog generation."""
        catalog = tool_registry.get_catalog()
        assert "Available Tools:" in catalog
        assert len(catalog) > 0

    def test_usage_stats(self):
        """Test usage statistics."""
        stats = tool_registry.get_usage_stats()
        assert "total_tools" in stats
        assert stats["total_tools"] > 0

    def test_to_openai_format(self):
        """Test OpenAI function calling format."""
        tools = tool_registry.to_openai_format()
        assert len(tools) > 0
        assert all("type" in t for t in tools)
        assert all("function" in t for t in tools)


class TestToolSearchTools:
    """Tests for tool_search LLM tools."""

    def test_tool_search_definition(self):
        """Verify tool_search tool definition."""
        tool = next(t for t in TOOL_SEARCH_TOOLS if t["name"] == "tool_search")
        assert tool is not None
        assert "query" in tool["parameters"]["properties"]
        assert tool["parameters"]["required"] == ["query"]

    def test_load_tool_definition(self):
        """Verify load_tool definition."""
        tool = next(t for t in TOOL_SEARCH_TOOLS if t["name"] == "load_tool")
        assert tool is not None
        assert "name" in tool["parameters"]["properties"]
        assert tool["parameters"]["required"] == ["name"]

    def test_get_tool_catalog_definition(self):
        """Verify get_tool_catalog definition."""
        tool = next(t for t in TOOL_SEARCH_TOOLS if t["name"] == "get_tool_catalog")
        assert tool is not None


class TestGenerateToolStubs:
    """Tests for sandbox bridge stub generation."""

    def test_generate_stubs_returns_string(self):
        """Verify stub generation returns string."""
        stubs = generate_tool_stubs()
        assert isinstance(stubs, str)
        assert "# Auto-generated tool stubs" in stubs

    def test_generate_stubs_contains_tools(self):
        """Verify stubs contain tool functions."""
        stubs = generate_tool_stubs()
        assert "def " in stubs
        assert '"""' in stubs

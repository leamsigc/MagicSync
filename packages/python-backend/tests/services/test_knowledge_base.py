import pytest
from app.services.tools.knowledge_base import KB_TOOLS


class TestKBToolsDefinitions:
    """Tests for KB tool definitions (LLM function calling)."""

    def test_kb_tools_has_five_tools(self):
        """Verify all 5 KB tools are defined."""
        assert len(KB_TOOLS) == 5

    def test_kb_ls_definition(self):
        """Verify kb_ls tool definition structure."""
        tool = next(t for t in KB_TOOLS if t["name"] == "kb_ls")
        assert tool["description"] is not None
        assert "folder_path" in tool["parameters"]["properties"]

    def test_kb_tree_definition(self):
        """Verify kb_tree tool definition structure."""
        tool = next(t for t in KB_TOOLS if t["name"] == "kb_tree")
        assert tool["description"] is not None

    def test_kb_grep_definition(self):
        """Verify kb_grep tool definition structure."""
        tool = next(t for t in KB_TOOLS if t["name"] == "kb_grep")
        assert "pattern" in tool["parameters"]["required"]

    def test_kb_glob_definition(self):
        """Verify kb_glob tool definition structure."""
        tool = next(t for t in KB_TOOLS if t["name"] == "kb_glob")
        assert "pattern" in tool["parameters"]["required"]

    def test_kb_read_definition(self):
        """Verify kb_read tool definition structure."""
        tool = next(t for t in KB_TOOLS if t["name"] == "kb_read")
        assert "document_id" in tool["parameters"]["required"]

    def test_all_tools_have_descriptions(self):
        """Verify all tools have non-empty descriptions."""
        for tool in KB_TOOLS:
            assert tool["description"], f"Tool {tool['name']} missing description"
            assert len(tool["description"]) > 10, f"Tool {tool['name']} has short description"

    def test_all_tools_have_parameters(self):
        """Verify all tools have parameters object."""
        for tool in KB_TOOLS:
            assert "parameters" in tool, f"Tool {tool['name']} missing parameters"
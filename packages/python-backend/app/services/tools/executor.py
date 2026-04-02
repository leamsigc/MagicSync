import json
import re
import logging
from app.services.tools.knowledge_base import KnowledgeBaseTools

logger = logging.getLogger(__name__)

TOOL_PATTERNS = {
    "kb_ls": [
        r"(?:list|show|ls)\s+(?:my\s+)?documents?\s+(?:in\s+)?(?:folder\s+)?([/\w-]+)?",
        r"(?:what|which)\s+documents?\s+(?:do I have|are in)\s+([/\w-]+)?",
    ],
    "kb_tree": [
        r"(?:show|get|display)\s+(?:the\s+)?tree\s+(?:of\s+)?(?:my\s+)?knowledge",
        r"(?:folder\s+)?structure",
    ],
    "kb_grep": [
        r"search\s+(?:for\s+)?(?:\"([^\"]+)\"|(\w+))\s+(?:in|within)\s+(?:folder\s+)?([/\w-]+)?",
        r"find\s+(?:\"([^\"]+)\"|(\w+))\s+(?:in|within)",
    ],
    "kb_glob": [
        r"(?:find|search|look\s+for)\s+(?:files?\s+)?matching\s+([*\w.]+)",
    ],
    "kb_read": [
        r"(?:read|show|get)\s+(?:content\s+of\s+)?(?:document\s+)?([a-f0-9-]{36})",
        r"(?:read|show|get)\s+(?:content\s+of\s+)?(?:file\s+)?\"([^\"]+)\"",
    ],
}

TOOL_KEYWORDS = {
    "kb_ls": ["list documents", "show documents", "ls folder", "my files", "what documents"],
    "kb_tree": ["folder tree", "knowledge tree", "folder structure", "show structure"],
    "kb_grep": ["search in", "search within", "find in folder", "grep"],
    "kb_glob": ["find files", "search files", "matching", "*.pdf", "*.doc"],
    "kb_read": ["read document", "show content", "file content", "open document"],
}


class ToolExecutor:
    """Detects tool usage in user messages and executes them."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.kb_tools = KnowledgeBaseTools(user_id)

    async def detect_and_execute(self, user_message: str) -> dict | None:
        """
        Check if user message requests a tool, execute if matched.
        
        Returns:
            dict with tool_name, result, or None if no match
        """
        msg_lower = user_message.lower()
        
        for tool_name, patterns in TOOL_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, msg_lower, re.IGNORECASE)
                if match:
                    logger.info(f"Tool detected: {tool_name} via pattern match")
                    return await self._execute_tool(tool_name, match, user_message)
        
        for tool_name, keywords in TOOL_KEYWORDS.items():
            for keyword in keywords:
                if keyword in msg_lower:
                    logger.info(f"Tool detected: {tool_name} via keyword match")
                    return await self._execute_tool_by_name(tool_name, user_message)
        
        return None

    async def _execute_tool(self, tool_name: str, match: re.Match, original_message: str) -> dict:
        """Execute tool based on regex match groups."""
        
        if tool_name == "kb_ls":
            folder_path = match.group(1) if match.groups() else None
            result = await self.kb_tools.kb_ls(folder_path)
            return {"tool_name": "kb_ls", "result": result, "invoked_via": "pattern"}
        
        if tool_name == "kb_tree":
            result = await self.kb_tools.kb_tree()
            return {"tool_name": "kb_tree", "result": result, "invoked_via": "pattern"}
        
        if tool_name == "kb_grep":
            pattern = match.group(1) or match.group(2) or ""
            folder_path = match.group(3) if len(match.groups()) >= 3 else None
            result = await self.kb_tools.kb_grep(pattern, folder_path)
            return {"tool_name": "kb_grep", "result": result, "invoked_via": "pattern"}
        
        if tool_name == "kb_glob":
            pattern = match.group(1) if match.groups() else ""
            result = await self.kb_tools.kb_glob(pattern)
            return {"tool_name": "kb_glob", "result": result, "invoked_via": "pattern"}
        
        if tool_name == "kb_read":
            doc_id = match.group(1) if match.groups() else None
            if not doc_id:
                return {"tool_name": "kb_read", "result": {"error": "No document ID found"}, "invoked_via": "pattern"}
            result = await self.kb_tools.kb_read(doc_id)
            return {"tool_name": "kb_read", "result": result, "invoked_via": "pattern"}
        
        return {"tool_name": tool_name, "result": {"error": "Unknown tool"}, "invoked_via": "pattern"}

    async def _execute_tool_by_name(self, tool_name: str, original_message: str) -> dict:
        """Execute tool when detected via keyword (extract params from message)."""
        
        if tool_name == "kb_ls":
            result = await self.kb_tools.kb_ls(None)
            return {"tool_name": "kb_ls", "result": result, "invoked_via": "keyword"}
        
        if tool_name == "kb_tree":
            result = await self.kb_tools.kb_tree()
            return {"tool_name": "kb_tree", "result": result, "invoked_via": "keyword"}
        
        if tool_name == "kb_grep":
            search_patterns = re.findall(r'"([^"]+)"|(\w+)', original_message)
            pattern = search_patterns[0][0] or search_patterns[0][1] if search_patterns else "unknown"
            result = await self.kb_tools.kb_grep(pattern, None)
            return {"tool_name": "kb_grep", "result": result, "invoked_via": "keyword"}
        
        if tool_name == "kb_glob":
            patterns = re.findall(r'[*\w.]+\.\w+|\w+\*|\*\.?\w+', original_message)
            pattern = patterns[0] if patterns else "*"
            result = await self.kb_tools.kb_glob(pattern)
            return {"tool_name": "kb_glob", "result": result, "invoked_via": "keyword"}
        
        if tool_name == "kb_read":
            uuid_match = re.search(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', original_message, re.I)
            if uuid_match:
                result = await self.kb_tools.kb_read(uuid_match.group())
            else:
                result = {"error": "No document ID found in message"}
            return {"tool_name": "kb_read", "result": result, "invoked_via": "keyword"}
        
        return {"tool_name": tool_name, "result": {"error": "Unknown tool"}, "invoked_via": "keyword"}


def format_tool_result_for_context(tool_result: dict) -> str:
    """Format tool result as context message for LLM."""
    result = tool_result.get("result", {})
    tool_name = tool_result.get("tool_name", "unknown")
    
    if "error" in result:
        return f"[Tool Error: {tool_name}] {result.get('error', 'Unknown error')}"
    
    if tool_name == "kb_ls":
        folders = result.get("folders", [])
        docs = result.get("documents", [])
        lines = [f"Folder: {result.get('folder_path', '/')}"]
        if folders:
            lines.append("Subfolders:")
            for f in folders:
                lines.append(f"  📁 {f.get('name', 'unknown')}")
        if docs:
            lines.append("Documents:")
            for d in docs:
                lines.append(f"  📄 {d.get('original_name', d.get('filename', 'unknown'))}")
        if not folders and not docs:
            lines.append("  (empty)")
        return "\n".join(lines)
    
    if tool_name == "kb_tree":
        return f"[Tree View]\n{json.dumps(result.get('tree', {}), indent=2)[:1000]}"
    
    if tool_name == "kb_grep":
        matches = result.get("matches", [])
        lines = [f"Found {len(matches)} matches for '{result.get('pattern', '')}':"]
        for m in matches[:5]:
            lines.append(f"  📄 {m.get('filename', 'unknown')}: {m.get('content', '')[:100]}...")
        return "\n".join(lines)
    
    if tool_name == "kb_glob":
        matches = result.get("matches", [])
        lines = [f"Found {len(matches)} files matching '{result.get('pattern', '')}':"]
        for m in matches:
            lines.append(f"  📄 {m.get('original_name', m.get('filename', 'unknown'))}")
        return "\n".join(lines)
    
    if tool_name == "kb_read":
        doc = result.get("document", {})
        content = result.get("full_content", "")
        return f"Document: {doc.get('original_name', 'unknown')}\n\n{content[:2000]}"
    
    return str(result)[:500]
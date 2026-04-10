import logging
import json
import base64
from typing import Any

logger = logging.getLogger(__name__)


class ToolManager:
    """Central tool registry and executor for chat LLM function calling."""

    def __init__(self, user_id: str):
        self.user_id = user_id

    def get_tool_definitions(self) -> list[dict]:
        """Get all tool definitions for LLM function calling."""
        from app.services.tools.knowledge_base import KB_TOOLS
        from app.services.skills.tools import SKILL_TOOLS
        from app.services.mcp.client import MCP_TOOL_DEFINITIONS

        all_tools = [
            *KB_TOOLS,
            *SKILL_TOOLS,
            *MCP_TOOL_DEFINITIONS,
            *self._get_retrieve_tool(),
            *self._get_rag_search_tool(),
            *self._get_web_search_tool(),
        ]

        return [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool.get("parameters", {}),
                },
            }
            for tool in all_tools
        ]

    def _get_web_search_tool(self) -> list[dict]:
        """Get web search tool definition."""
        return [
            {
                "name": "web_search",
                "description": "Search the web for current information, trends, news, or anything not in your documents. Use this when you need up-to-date information or don't have the answer in your knowledge base.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query",
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum number of results to return",
                            "default": 5,
                        },
                    },
                    "required": ["query"],
                },
            }
        ]

    def _get_retrieve_tool(self) -> list[dict]:
        """Get retrieve tool for RAG."""
        return [
            {
                "name": "retrieve",
                "description": "Search and retrieve relevant content from your knowledge base using semantic search. Use this when the user asks about information from your documents.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query to find relevant content",
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return",
                            "default": 5,
                        },
                    },
                    "required": ["query"],
                },
            }
        ]

    def _get_rag_search_tool(self) -> list[dict]:
        """Get hybrid search tool for document queries."""
        return [
            {
                "name": "hybrid_search",
                "description": "Perform hybrid search (keyword + vector) across your documents. Best for detailed document queries.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The search query"},
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results",
                            "default": 10,
                        },
                    },
                    "required": ["query"],
                },
            }
        ]

    async def execute_tool(self, tool_name: str, arguments: dict) -> dict:
        """Execute a tool by name with given arguments."""
        logger.info(f"Executing tool: {tool_name} with args: {arguments}")

        if tool_name == "retrieve":
            return await self._execute_retrieve(arguments)
        if tool_name == "hybrid_search":
            return await self._execute_hybrid_search(arguments)
        if tool_name == "kb_ls":
            return await self._execute_kb_ls(arguments)
        if tool_name == "kb_tree":
            return await self._execute_kb_tree(arguments)
        if tool_name == "kb_grep":
            return await self._execute_kb_grep(arguments)
        if tool_name == "kb_glob":
            return await self._execute_kb_glob(arguments)
        if tool_name == "kb_read":
            return await self._execute_kb_read(arguments)
        if tool_name == "load_skill":
            return await self._execute_load_skill(arguments)
        if tool_name == "execute_code":
            return await self._execute_code(arguments)
        if tool_name == "save_skill":
            return await self._execute_save_skill(arguments)
        if tool_name == "list_skills":
            return await self._execute_list_skills(arguments)
        if tool_name == "mcp_list_servers":
            return await self._execute_mcp_list_servers()
        if tool_name == "mcp_discover_tools":
            return await self._execute_mcp_discover_tools(arguments)
        if tool_name == "mcp_execute":
            return await self._execute_mcp_execute(arguments)
        if tool_name == "import_skill_from_zip":
            return await self._execute_import_skill_from_zip(arguments)
        if tool_name == "import_skill_from_url":
            return await self._execute_import_skill_from_url(arguments)
        if tool_name == "import_skill_from_folder":
            return await self._execute_import_skill_from_folder(arguments)
        if tool_name == "generate_twitter_post":
            return await self._execute_generate_twitter_post(arguments)
        if tool_name == "web_search":
            return await self._execute_web_search(arguments)

        return {"error": f"Unknown tool: {tool_name}"}

    async def _execute_web_search(self, args: dict) -> dict:
        """Execute web search."""
        from app.services.tools.web_search import web_search_service

        query = args.get("query", "")
        max_results = args.get("max_results", 5)

        logger.info(f"Executing web search for: {query}")
        
        try:
            result = await web_search_service.search(query, max_results)
            logger.info(f"Web search returned {len(result.get('results', []))} results")
            return result
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return {"error": str(e), "results": []}

    async def _execute_retrieve(self, args: dict) -> dict:
        """Execute RAG retrieval."""
        from app.services.rag.embeddings import embedding_service

        query = args.get("query", "")
        top_k = args.get("top_k", 5)

        try:
            embedding = await embedding_service.embed(query)
            from app.core.db import get_db_pool
            from app.services.rag import chunk_text

            pool = get_db_pool()
            async with pool.acquire() as conn:
                embedding_str = f"[{','.join(map(str, embedding))}]"
                results = await conn.execute(
                    """
                    SELECT dc.content, dc.document_id, d.filename,
                           vector_distance_cos(dc.embedding, vector32(?)) as similarity
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE dc.user_id = ?
                    ORDER BY similarity ASC
                    LIMIT ?
                    """,
                    (self.user_id, embedding_str, top_k),
                )

                chunks = []
                for row in results.fetchall():
                    chunks.append(
                        {
                            "content": row[0],
                            "document_id": row[1],
                            "filename": row[2],
                            "score": 1 - row[3],
                        }
                    )

                return {"query": query, "results": chunks, "count": len(chunks)}
        except Exception as e:
            logger.error(f"Retrieve failed: {e}")
            return {"error": str(e), "results": []}

    async def _execute_hybrid_search(self, args: dict) -> dict:
        """Execute hybrid search (keyword + vector)."""
        from app.services.rag.embeddings import embedding_service

        query = args.get("query", "")
        limit = args.get("limit", 10)

        try:
            embedding = await embedding_service.embed(query)
            from app.core.db import get_db_pool

            pool = get_db_pool()
            async with pool.acquire() as conn:
                embedding_str = f"[{','.join(map(str, embedding))}]"

                results = await conn.execute(
                    """
                    SELECT dc.content, dc.document_id, d.filename,
                           vector_distance_cos(dc.embedding, vector32(?)) as similarity
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE dc.user_id = ?
                    ORDER BY similarity ASC
                    LIMIT ?
                    """,
                    (self.user_id, embedding_str, limit),
                )

                chunks = []
                for row in results.fetchall():
                    chunks.append(
                        {
                            "content": row[0],
                            "document_id": row[1],
                            "filename": row[2],
                            "score": 1 - row[3],
                        }
                    )

                return {"query": query, "results": chunks, "count": len(chunks)}
        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            return {"error": str(e), "results": []}

    async def _execute_kb_ls(self, args: dict) -> dict:
        from app.services.tools.knowledge_base import KnowledgeBaseTools

        kb = KnowledgeBaseTools(self.user_id)
        return await kb.kb_ls(args.get("folder_path"))

    async def _execute_kb_tree(self, args: dict) -> dict:
        from app.services.tools.knowledge_base import KnowledgeBaseTools

        kb = KnowledgeBaseTools(self.user_id)
        return await kb.kb_tree(args.get("folder_path"))

    async def _execute_kb_grep(self, args: dict) -> dict:
        from app.services.tools.knowledge_base import KnowledgeBaseTools

        kb = KnowledgeBaseTools(self.user_id)
        return await kb.kb_grep(
            args.get("pattern", ""), args.get("folder_path"), args.get("limit", 10)
        )

    async def _execute_kb_glob(self, args: dict) -> dict:
        from app.services.tools.knowledge_base import KnowledgeBaseTools

        kb = KnowledgeBaseTools(self.user_id)
        return await kb.kb_glob(args.get("pattern", "*"))

    async def _execute_kb_read(self, args: dict) -> dict:
        from app.services.tools.knowledge_base import KnowledgeBaseTools

        kb = KnowledgeBaseTools(self.user_id)
        return await kb.kb_read(args.get("document_id", ""))

    async def _execute_load_skill(self, args: dict) -> dict:
        from app.services.skills.tools import SkillTools

        skill_tools = SkillTools(self.user_id)
        return await skill_tools.load_skill(args.get("name", ""))

    async def _execute_code(self, args: dict) -> dict:
        from app.services.skills.tools import CodeSandbox

        sandbox = CodeSandbox(self.user_id)
        return await sandbox.execute_code(args.get("code", ""), args.get("session_id"))

    async def _execute_save_skill(self, args: dict) -> dict:
        from app.services.skills.tools import SkillTools

        skill_tools = SkillTools(self.user_id)
        return await skill_tools.save_skill(
            args.get("name", ""),
            args.get("description", ""),
            args.get("instructions", ""),
            args.get("enabled", True),
        )

    async def _execute_list_skills(self, args: dict) -> dict:
        from app.services.skills.tools import SkillTools

        skill_tools = SkillTools(self.user_id)
        return await skill_tools.list_skills()

    async def _execute_mcp_list_servers(self) -> dict:
        from app.services.mcp.client import mcp_client

        servers = mcp_client.get_servers()
        return {"servers": servers, "count": len(servers)}

    async def _execute_mcp_discover_tools(self, args: dict) -> dict:
        from app.services.mcp.client import mcp_client

        server_name = args.get("server_name", "")
        tools = await mcp_client.discover_tools(server_name)
        return {"server": server_name, "tools": tools, "count": len(tools)}

    async def _execute_mcp_execute(self, args: dict) -> dict:
        from app.services.mcp.client import mcp_client

        return await mcp_client.execute_tool(
            args.get("server_name", ""),
            args.get("tool_name", ""),
            args.get("arguments", {}),
        )

    async def _execute_import_skill_from_zip(self, args: dict) -> dict:
        import base64
        from app.services.skills.tools import SkillTools

        skill_tools = SkillTools(self.user_id)

        zip_base64 = args.get("zip_base64", "")
        try:
            zip_content = base64.b64decode(zip_base64)
        except Exception as e:
            return {"error": f"Invalid base64: {e}"}

        return await skill_tools.import_skill_from_zip(zip_content)

    async def _execute_import_skill_from_url(self, args: dict) -> dict:
        from app.services.skills.tools import SkillTools

        skill_tools = SkillTools(self.user_id)

        url = args.get("url", "")
        if not url:
            return {"error": "URL is required"}

        return await skill_tools.import_skill_from_url(url)

    async def _execute_import_skill_from_folder(self, args: dict) -> dict:
        from app.services.skills.tools import SkillTools

        skill_tools = SkillTools(self.user_id)

        folder_path = args.get("folder_path", "")
        if not folder_path:
            return {"error": "folder_path is required"}

        return await skill_tools.import_skill_from_folder(folder_path)

    async def _execute_generate_twitter_post(self, args: dict) -> dict:
        """Generate social media post content."""
        import random
        
        text = args.get("text", "")
        hashtags = args.get("hashtags", [])
        
        if not text:
            twitter_templates = [
                "Making Twitter better starts with clarity and engagement! What's your favorite feature?",
                "Just realized: the best way to make Twitter better is by listening to users! Your feedback matters.",
                "Imagine a Twitter where every tweet sparks meaningful conversations. Let's build that together!",
            ]
            text = random.choice(twitter_templates)
        
        if not hashtags:
            hashtags = ["#TwitterTips", "#SocialMedia", "#Engagement"]
        
        return {
            "text": text,
            "hashtags": hashtags,
            "platform": "twitter",
            "character_count": len(text + " " + " ".join(hashtags)),
        }


def format_retrieve_result(result: dict) -> str:
    """Format retrieval results for LLM context."""
    if "error" in result:
        return f"[Retrieval Error: {result.get('error')}]"

    results = result.get("results", [])
    if not results:
        return "No relevant documents found."

    lines = [f"Found {len(results)} relevant chunks:"]
    for i, r in enumerate(results[:5]):
        content = r.get("content", "")[:300]
        filename = r.get("filename", "unknown")
        lines.append(f"\n--- Result {i + 1} ({filename}) ---\n{content}...")

    return "\n".join(lines)


def format_tool_result(tool_name: str, result: dict) -> str:
    """Format tool execution result for LLM context."""
    # Only treat as error if error key has a non-None value
    if "error" in result and result.get("error"):
        return f"[Tool Error: {tool_name}] {result.get('error')}"

    if tool_name in ("retrieve", "hybrid_search"):
        return format_retrieve_result(result)

    # Return as-is for execute_code, web_search, generate_twitter_post, etc.
    return json.dumps(result, indent=2)[:2000]

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
            *self._get_scrape_tool(),
            *self._get_social_media_tools(),
            *self._get_analytics_tools(),
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
        if tool_name == "generate_social_post":
            return await self._execute_generate_social_post(arguments)
        if tool_name == "generate_thread":
            return await self._execute_generate_thread(arguments)
        if tool_name == "generate_hashtags":
            return await self._execute_generate_hashtags(arguments)
        if tool_name == "web_search":
            return await self._execute_web_search(arguments)
        if tool_name == "scrape_url":
            return await self._execute_scrape_url(arguments)
        if tool_name == "virality_check":
            return await self._execute_virality_check(arguments)
        if tool_name == "engagement_calc":
            return await self._execute_engagement_calc(arguments)
        if tool_name == "best_posts":
            return await self._execute_best_posts(arguments)
        if tool_name == "destructure_post":
            return await self._execute_destructure_post(arguments)
        if tool_name == "apply_template":
            return await self._execute_apply_template(arguments)

        return {"error": f"Unknown tool: {tool_name}"}

    def _get_scrape_tool(self) -> list[dict]:
        """Get structured URL extraction tool (ScrapeGraphAI with fallbacks)."""
        return [
            {
                "name": "scrape_url",
                "description": "Extract specific information from a web page as structured data (topics, offers, hooks, testimonials, pricing). Use when research needs details from a business site, blog post, or reference document — not just raw page text.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The page URL to extract from",
                        },
                        "prompt": {
                            "type": "string",
                            "description": "What to extract, e.g. 'list the offers, hooks and testimonials'",
                        },
                        "provider": {
                            "type": "string",
                            "description": "LLM provider for extraction",
                            "default": "ollama",
                        },
                        "model": {
                            "type": "string",
                            "description": "LLM model for extraction",
                            "default": "qwen3.5",
                        },
                    },
                    "required": ["url", "prompt"],
                },
            }
        ]

    async def _execute_scrape_url(self, args: dict) -> dict:
        """Execute structured URL extraction."""
        from app.services.research import scraper

        url = args.get("url", "")
        prompt = args.get("prompt", "")
        if not url or not prompt:
            return {"error": "url and prompt are required", "backend": "none"}

        try:
            return await scraper.extract(
                url,
                prompt,
                provider=args.get("provider", "ollama"),
                model=args.get("model", "qwen3.5"),
                api_key=args.get("api_key"),
                api_base=args.get("api_base"),
            )
        except Exception as e:
            logger.error(f"scrape_url failed: {e}")
            return {"error": str(e), "backend": "none"}

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

            pool = await get_db_pool()
            conn = await pool.acquire()
            async with conn:
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

            pool = await get_db_pool()
            conn = await pool.acquire()
            async with conn:
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
        # Catalog parity: the DSH plugin sends `skill_name`; accept legacy `name`.
        return await skill_tools.load_skill(args.get("skill_name") or args.get("name", ""))

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

    def _get_social_media_tools(self) -> list[dict]:
        """Get social media generation tool definitions."""
        return [
            {
                "name": "generate_social_post",
                "description": "Generate a social media post for a specific platform. Use when user wants to create content for Twitter, LinkedIn, Instagram, Facebook, Threads, Bluesky, or other platforms.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "The main topic or theme of the post",
                        },
                        "platform": {
                            "type": "string",
                            "description": "Target platform (twitter, linkedin, instagram, facebook, threads, bluesky, etc.)",
                        },
                        "tone": {
                            "type": "string",
                            "description": "Tone of voice",
                            "enum": ["professional", "casual", "humorous", "informative", "inspirational"],
                            "default": "professional",
                        },
                        "include_hashtags": {
                            "type": "boolean",
                            "description": "Whether to include relevant hashtags",
                            "default": True,
                        },
                        "include_cta": {
                            "type": "boolean",
                            "description": "Whether to include a call-to-action",
                            "default": False,
                        },
                        "additional_context": {
                            "type": "string",
                            "description": "Additional context or specific requirements",
                            "default": "",
                        },
                    },
                    "required": ["topic", "platform"],
                },
            },
            {
                "name": "generate_thread",
                "description": "Generate a thread/tweetstorm for platforms that support it (Twitter/X, Threads, Bluesky). Use when user wants to create multiple connected posts on a topic.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "The thread topic or theme",
                        },
                        "platform": {
                            "type": "string",
                            "description": "Base platform (twitter, threads, bluesky)",
                            "default": "twitter",
                        },
                        "tweet_count": {
                            "type": "integer",
                            "description": "Number of tweets in the thread",
                            "default": 5,
                        },
                        "hook_first": {
                            "type": "boolean",
                            "description": "Start with a compelling hook",
                            "default": True,
                        },
                    },
                    "required": ["topic"],
                },
            },
            {
                "name": "generate_hashtags",
                "description": "Generate optimized hashtags for a topic and platform. Use when user wants hashtag suggestions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "The post topic",
                        },
                        "platform": {
                            "type": "string",
                            "description": "Target platform",
                        },
                        "count": {
                            "type": "integer",
                            "description": "Number of hashtags to generate",
                            "default": 5,
                        },
                        "style": {
                            "type": "string",
                            "description": "Hashtag style",
                            "enum": ["popular", "niche", "mixed", "trending"],
                            "default": "mixed",
                        },
                    },
                    "required": ["topic", "platform"],
                },
            },
        ]

    async def _execute_generate_twitter_post(self, args: dict) -> dict:
        """Generate social media post content using AI."""
        from app.services.social_media.generator import get_social_media_generator

        topic = args.get("topic", args.get("text", ""))
        platform = args.get("platform", "twitter")
        tone = args.get("tone", "professional")
        include_hashtags = args.get("include_hashtags", True)
        include_cta = args.get("include_cta", False)
        additional_context = args.get("additional_context", "")

        if not topic:
            return {"error": "Topic is required for post generation"}

        generator = get_social_media_generator(self.user_id)
        
        try:
            result = await generator.generate_post(
                topic=topic,
                platform=platform,
                tone=tone,
                include_hashtags=include_hashtags,
                include_cta=include_cta,
                additional_context=additional_context,
            )
            return result
        except Exception as e:
            logger.error(f"Social media generation failed: {e}")
            return {"error": f"Generation failed: {str(e)}"}

    async def _execute_generate_social_post(self, args: dict) -> dict:
        """Generate a social media post for any supported platform."""
        from app.services.social_media.generator import get_social_media_generator

        topic = args.get("topic", args.get("text", ""))
        platform = args.get("platform", "twitter")
        tone = args.get("tone", "professional")
        include_hashtags = args.get("include_hashtags", True)
        include_cta = args.get("include_cta", False)
        additional_context = args.get("additional_context", "")

        if not topic:
            return {"error": "Topic is required for post generation"}

        generator = get_social_media_generator(self.user_id)

        try:
            result = await generator.generate_post(
                topic=topic,
                platform=platform,
                tone=tone,
                include_hashtags=include_hashtags,
                include_cta=include_cta,
                additional_context=additional_context,
            )
            return result
        except Exception as e:
            logger.error(f"Social media generation failed: {e}")
            return {"error": f"Generation failed: {str(e)}"}

    async def _execute_generate_thread(self, args: dict) -> dict:
        """Generate a thread/tweetstorm."""
        from app.services.social_media.generator import get_social_media_generator

        topic = args.get("topic", "")
        platform = args.get("platform", "twitter")
        tweet_count = args.get("tweet_count", 5)
        hook_first = args.get("hook_first", True)

        if not topic:
            return {"error": "Topic is required for thread generation"}

        generator = get_social_media_generator(self.user_id)
        
        try:
            result = await generator.generate_thread(
                topic=topic,
                platform=platform,
                tweet_count=tweet_count,
                hook_first=hook_first,
            )
            return result
        except Exception as e:
            logger.error(f"Thread generation failed: {e}")
            return {"error": f"Thread generation failed: {str(e)}"}

    async def _execute_generate_hashtags(self, args: dict) -> dict:
        """Generate hashtags for a topic."""
        from app.services.social_media.generator import get_social_media_generator

        topic = args.get("topic", "")
        platform = args.get("platform", "twitter")
        count = args.get("count", 5)
        style = args.get("style", "mixed")

        if not topic:
            return {"error": "Topic is required for hashtag generation"}

        generator = get_social_media_generator(self.user_id)
        
        try:
            result = await generator.generate_hashtags(
                topic=topic,
                platform=platform,
                count=count,
                style=style,
            )
            return result
        except Exception as e:
            logger.error(f"Hashtag generation failed: {e}")
            return {"error": f"Hashtag generation failed: {str(e)}"}

    def _get_analytics_tools(self) -> list[dict]:
        """Get chat analytics tool definitions for social posts."""
        return [
            {
                "name": "virality_check",
                "description": "Score how viral a post is (0-100 score plus sleeper/steady/viral/breakout tier). Use when the user asks how a post performed, whether a post went viral, or wants a take on a draft. Provide post_id for a published post, or content for an unpublished draft.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "post_id": {
                            "type": "string",
                            "description": "ID of a published post to score from collected metrics",
                        },
                        "content": {
                            "type": "string",
                            "description": "Draft post text to structurally assess (no metrics available)",
                        },
                    },
                },
            },
            {
                "name": "engagement_calc",
                "description": "Calculate engagement rates for one or more published posts from collected metrics. Use when the user wants to compare performance across specific posts or needs exact engagement numbers.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "post_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of published post IDs to score",
                        },
                    },
                    "required": ["post_ids"],
                },
            },
            {
                "name": "best_posts",
                "description": "Find the top-performing published posts from the last N days, ranked by engagement rate. Use when the user asks what performed best, what to repost or boost, or wants examples of winning content to imitate.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "days": {
                            "type": "integer",
                            "description": "Lookback window in days",
                            "default": 7,
                        },
                        "platform": {
                            "type": "string",
                            "description": "Optional platform filter (e.g. twitter, linkedin, instagram)",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum posts to return",
                            "default": 5,
                        },
                    },
                },
            },
            {
                "name": "destructure_post",
                "description": "Break a published post into a reusable content template (hook style, structure, CTA style, tone notes). Use when the user wants to replicate a winning post format or asks why a post worked structurally.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "post_id": {
                            "type": "string",
                            "description": "ID of the published post to destructure",
                        },
                    },
                    "required": ["post_id"],
                },
            },
            {
                "name": "apply_template",
                "description": "Apply a content template from destructure_post to a new theme, producing an outline plus caption draft notes. Use when the user wants a new post written in the style of a previous winner.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "template": {
                            "type": "object",
                            "description": "Template object returned by destructure_post",
                        },
                        "theme": {
                            "type": "string",
                            "description": "New topic or theme for the post",
                        },
                        "business_context": {
                            "type": "string",
                            "description": "Optional business context to weave into the draft notes",
                            "default": "",
                        },
                    },
                    "required": ["template", "theme"],
                },
            },
        ]

    async def _execute_virality_check(self, args: dict) -> dict:
        """Score virality for a published post or draft content.

        Metrics come from the authoritative Nuxt analytics service
        (business-scoped); scores are never fabricated from zeros.
        """
        from app.core.config import settings
        from app.services.analytics.nuxt import call_internal_analytics

        post_id = args.get("post_id")
        content = args.get("content")
        business_id = args.get("business_id")
        if not post_id and not isinstance(content, str):
            return {
                "error": "Provide post_id for a published post "
                "or content for a draft."
            }
        if post_id and not business_id:
            return {"error": "business_id is required for post virality."}

        try:
            if post_id:
                data = await call_internal_analytics(
                    settings,
                    "/api/v1/internal/analytics/performance",
                    {"userId": self.user_id, "businessId": business_id, "postId": post_id},
                )
                metrics = data.get("metrics") or {}
                return {
                    "post_id": post_id,
                    "metrics": metrics,
                    "engagement_rate": metrics.get("engagementRate"),
                    "score": metrics.get("viralityScore"),
                    "reason": "Measured engagement and reach"
                    if metrics.get("viralityScore") is not None
                    else "Insufficient metric coverage",
                    "warnings": data.get("warnings", []),
                    "source": "authoritative",
                }
            return {
                "post_id": None,
                "score": None,
                "reason": "Draft content has no collected metrics",
                "source": "authoritative",
            }
        except Exception as e:
            logger.error(f"virality_check failed: {e}")
            return {"error": f"virality_check failed: {e}"}

    async def _execute_engagement_calc(self, args: dict) -> dict:
        """Calculate engagement rates for a list of published posts."""
        from app.core.config import settings
        from app.services.analytics.nuxt import call_internal_analytics

        post_ids = args.get("post_ids", [])
        business_id = args.get("business_id")
        if not isinstance(post_ids, list) or not post_ids:
            return {"error": "Provide post_ids as a non-empty list of post IDs."}
        if not business_id:
            return {"error": "business_id is required for engagement calc."}

        try:
            data = await call_internal_analytics(
                settings,
                "/api/v1/internal/analytics/engagement",
                {"userId": self.user_id, "businessId": business_id, "postIds": post_ids},
            )
            results = [
                {"post_id": item["postId"], "engagement_rate": item["engagementRate"]}
                for item in data.get("rates", [])
            ]
            return {"results": results, "count": len(results), "source": "authoritative"}
        except Exception as e:
            logger.error(f"engagement_calc failed: {e}")
            return {"error": f"engagement_calc failed: {e}"}

    async def _execute_best_posts(self, args: dict) -> dict:
        """Return top published posts ranked by engagement rate.

        Rankings use the latest valid snapshot per post (never summed
        cumulative snapshots) from the authoritative analytics service.
        """
        from app.core.config import settings
        from app.services.analytics.nuxt import call_internal_analytics

        days = args.get("days", 7)
        platform = args.get("platform")
        limit = args.get("limit", 5)
        business_id = args.get("business_id")
        if not business_id:
            return {"error": "business_id is required for best posts."}

        try:
            data = await call_internal_analytics(
                settings,
                "/api/v1/internal/analytics/best-posts",
                {
                    "userId": self.user_id,
                    "businessId": business_id,
                    "days": days,
                    "platform": platform,
                    "limit": limit,
                },
            )
            ranked = data.get("posts", [])
            return {
                "posts": ranked,
                "count": len(ranked),
                "days": days,
                "platform": platform,
                "warnings": data.get("warnings", []),
                "source": "authoritative",
            }
        except Exception as e:
            logger.error(f"best_posts failed: {e}")
            return {"error": f"best_posts failed: {e}"}

    async def _execute_destructure_post(self, args: dict) -> dict:
        """Break a published post into a reusable template."""
        from app.core.config import settings
        from app.services.analytics.nuxt import call_internal_analytics

        post_id = args.get("post_id", "")
        business_id = args.get("business_id")
        if not post_id:
            return {"error": "post_id is required."}
        if not business_id:
            return {"error": "business_id is required to destructure a post."}

        try:
            data = await call_internal_analytics(
                settings,
                "/api/v1/internal/analytics/performance",
                {"userId": self.user_id, "businessId": business_id, "postId": post_id},
            )
            structure = data.get("structure", {})
            metrics = data.get("metrics") or {}
            blocks = structure.get("blocks", [])
            return {
                "sourcePostId": post_id,
                "hook": {"style": structure.get("hookStyle", "statement")},
                "structure": ["hook", "problem", "lesson", "cta"] if len(blocks) > 3 else ["hook", "body", "cta"],
                "tone": ["direct"],
                "cta": {"style": "question"},
                "performance": {
                    "engagementRate": metrics.get("engagementRate"),
                    "viralityScore": metrics.get("viralityScore"),
                },
                "evidence": [f"post:{post_id}"],
                "source": "authoritative",
            }
        except Exception as e:
            logger.error(f"destructure_post failed: {e}")
            return {"error": f"destructure_post failed: {e}"}

    async def _execute_apply_template(self, args: dict) -> dict:
        """Apply a content template to a new theme (no DB needed)."""
        from app.services.analytics.posts import apply_template as _apply

        template = args.get("template", {})
        theme = args.get("theme", "")
        business_context = args.get("business_context", "")
        if not isinstance(template, dict) or not theme:
            return {"error": "Provide template (object) and a non-empty theme."}

        try:
            context = (
                business_context if isinstance(business_context, str) else ""
            )
            return _apply(template, theme, context)
        except Exception as e:
            logger.error(f"apply_template failed: {e}")
            return {"error": f"apply_template failed: {e}"}


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

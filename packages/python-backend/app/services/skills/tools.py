import logging
import json
from typing import Optional
from app.services.llm import llm_service

logger = logging.getLogger(__name__)


class SkillTools:
    """Tools for loading and managing agent skills."""

    def __init__(self, user_id: str):
        self.user_id = user_id

    async def load_skill(self, skill_name: str) -> dict:
        """
        Load full skill instructions by name.
        
        Used by LLM when query matches skill description.
        """
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """SELECT id, name, description, instructions 
                       FROM skills 
                       WHERE name = ? AND (user_id = ? OR is_global = 1) AND enabled = 1""",
                    (skill_name, self.user_id)
                )
                
                row = result.one_or_none()
                if not row:
                    return {
                        "error": f"Skill '{skill_name}' not found or not accessible",
                        "skill_name": skill_name
                    }
                
                return {
                    "skill_name": row[1],
                    "description": row[2],
                    "instructions": row[3]
                }
        except Exception as e:
            logger.error(f"load_skill failed: {e}")
            return {"error": str(e), "skill_name": skill_name}

    async def save_skill(
        self,
        name: str,
        description: str,
        instructions: str,
        is_global: bool = False
    ) -> dict:
        """
        Save a new skill created by AI guidance.
        """
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                skill_id = f"skill-{self.user_id}-{name}"
                
                await conn.execute(
                    """INSERT INTO skills (id, user_id, name, description, instructions, is_global, enabled)
                       VALUES (?, ?, ?, ?, ?, ?, 1)""",
                    (skill_id, self.user_id, name, description, instructions, is_global)
                )
                
                return {
                    "success": True,
                    "skill_id": skill_id,
                    "name": name
                }
        except Exception as e:
            logger.error(f"save_skill failed: {e}")
            return {"error": str(e), "success": False}

    async def list_skills(self) -> dict:
        """List all available skills for the user."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """SELECT name, description FROM skills 
                       WHERE (user_id = ? OR is_global = 1) AND enabled = 1""",
                    (self.user_id,)
                )
                
                skills = [{"name": row[0], "description": row[1]} for row in result.fetchall()]
                return {"skills": skills, "count": len(skills)}
        except Exception as e:
            logger.error(f"list_skills failed: {e}")
            return {"skills": [], "error": str(e)}

    async def read_skill_file(self, skill_name: str, filename: str) -> dict:
        """Read content of an attached skill file."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """SELECT sf.filename, sf.content, sf.mime_type 
                       FROM skill_files sf
                       JOIN skills s ON sf.skill_id = s.id
                       WHERE s.name = ? AND sf.filename = ? AND (s.user_id = ? OR s.is_global = 1)""",
                    (skill_name, filename, self.user_id)
                )
                
                row = result.one_or_none()
                if not row:
                    return {"error": f"File '{filename}' not found in skill '{skill_name}'"}
                
                return {
                    "filename": row[0],
                    "content": row[1].decode('utf-8') if row[1] else "",
                    "mime_type": row[2]
                }
        except Exception as e:
            logger.error(f"read_skill_file failed: {e}")
            return {"error": str(e)}


class CodeSandbox:
    """Sandboxed code execution tool."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.enabled = False  # Disabled by default per plan

    async def execute_code(
        self,
        code: str,
        session_id: Optional[str] = None
    ) -> dict:
        """
        Execute Python code in sandboxed container.
        
        Note: Sandbox is disabled by default. Returns stub response.
        """
        if not self.enabled:
            return {
                "error": "Code execution sandbox is disabled",
                "code": code[:100] + "..." if len(code) > 100 else code,
                "output": None,
                "status": "disabled"
            }
        
        # Placeholder - actual implementation would use Docker + llm-sandbox
        try:
            # In real implementation:
            # 1. Create Docker container with custom image
            # 2. Run code with IPython persistence
            # 3. Stream stdout/stderr via SSE
            # 4. Upload generated files to storage
            
            return {
                "output": "Sandbox execution not implemented",
                "status": "stub",
                "session_id": session_id
            }
        except Exception as e:
            logger.error(f"execute_code failed: {e}")
            return {
                "error": str(e),
                "status": "failed"
            }


SKILL_TOOLS = [
    {
        "name": "load_skill",
        "description": "Load full instructions for a specific skill by name. Use when user query matches a skill description.",
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "Name of the skill to load (e.g., 'analyzing-sales-data')"
                }
            },
            "required": ["skill_name"]
        }
    },
    {
        "name": "save_skill",
        "description": "Save a newly created skill to make it available for future use.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Skill name (lowercase, hyphenated)"
                },
                "description": {
                    "type": "string",
                    "description": "Brief description of what the skill does"
                },
                "instructions": {
                    "type": "string",
                    "description": "Full markdown instructions for the skill"
                },
                "is_global": {
                    "type": "boolean",
                    "description": "Whether skill should be available to all users"
                }
            },
            "required": ["name", "description", "instructions"]
        }
    },
    {
        "name": "list_skills",
        "description": "List all available skills that can be loaded. Use to discover what skills exist.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "read_skill_file",
        "description": "Read content of a file attached to a skill.",
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "Name of the skill"
                },
                "filename": {
                    "type": "string",
                    "description": "Name of the file to read"
                }
            },
            "required": ["skill_name", "filename"]
        }
    },
    {
        "name": "execute_code",
        "description": "Execute Python code in a sandboxed Docker container. Use for data analysis, file generation, or computations.",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python code to execute"
                },
                "session_id": {
                    "type": "string",
                    "description": "Optional session ID for persistent state across calls"
                }
            },
            "required": ["code"]
        }
    }
]


def get_skill_catalog_prompt() -> str:
    """Generate system prompt with skill catalog for progressive discovery."""
    return """
You have access to custom skills. Only load a skill if the user's query clearly matches its description.

Available Skills:
- (loaded on demand via load_skill tool)

When user asks to create a new skill, use save_skill to persist it.
When user asks to execute code or do data analysis, use execute_code (if enabled).
"""
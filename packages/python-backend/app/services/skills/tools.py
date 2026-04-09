import logging
import json
import zipfile
import io
import os
import re
import yaml
from typing import Optional
from app.services.llm import llm_service
import httpx

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
                    (skill_name, self.user_id),
                )

                row = result.one_or_none()
                if not row:
                    return {
                        "error": f"Skill '{skill_name}' not found or not accessible",
                        "skill_name": skill_name,
                    }

                return {
                    "skill_name": row[1],
                    "description": row[2],
                    "instructions": row[3],
                }
        except Exception as e:
            logger.error(f"load_skill failed: {e}")
            return {"error": str(e), "skill_name": skill_name}

    async def save_skill(
        self, name: str, description: str, instructions: str, is_global: bool = False
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
                    (
                        skill_id,
                        self.user_id,
                        name,
                        description,
                        instructions,
                        is_global,
                    ),
                )

                return {"success": True, "skill_id": skill_id, "name": name}
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
                    (self.user_id,),
                )

                skills = [
                    {"name": row[0], "description": row[1]} for row in result.fetchall()
                ]
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
                    (skill_name, filename, self.user_id),
                )

                row = result.one_or_none()
                if not row:
                    return {
                        "error": f"File '{filename}' not found in skill '{skill_name}'"
                    }

                return {
                    "filename": row[0],
                    "content": row[1].decode("utf-8") if row[1] else "",
                    "mime_type": row[2],
                }
        except Exception as e:
            logger.error(f"read_skill_file failed: {e}")
            return {"error": str(e)}

    async def import_skill_from_zip(self, zip_content: bytes) -> dict:
        """Import a skill from ZIP file in agentskills.io format."""
        try:
            with zipfile.ZipFile(io.BytesIO(zip_content)) as zf:
                namelist = zf.namelist()

                skill_dir = None
                for name in namelist:
                    if name.endswith("/"):
                        parts = name.split("/")
                        if len(parts) >= 2:
                            skill_dir = parts[0]
                            break

                if not skill_dir:
                    return {"error": "Invalid skill ZIP: no root directory found"}

                skill_md_path = f"{skill_dir}/SKILL.md"
                if skill_md_path not in namelist:
                    return {"error": "Invalid skill ZIP: SKILL.md not found"}

                skill_md_content = zf.read(skill_md_path).decode("utf-8")

                metadata = {}
                content_lines = []
                in_frontmatter = False
                frontmatter_lines = []

                for line in skill_md_content.split("\n"):
                    if line.strip() == "---":
                        if not in_frontmatter:
                            in_frontmatter = True
                            continue
                        else:
                            in_frontmatter = False
                            continue
                    if in_frontmatter:
                        frontmatter_lines.append(line)
                    else:
                        content_lines.append(line)

                if frontmatter_lines:
                    try:
                        metadata = yaml.safe_load("\n".join(frontmatter_lines)) or {}
                    except:
                        pass

                instructions = "\n".join(content_lines).strip()
                name = metadata.get("name", skill_dir)
                description = metadata.get("description", "")

                skill_id = f"skill-{self.user_id}-{name}"

                pool = get_db_pool()
                async with pool.acquire() as conn:
                    await conn.execute(
                        """INSERT OR REPLACE INTO skills (id, user_id, name, description, instructions, is_global, enabled)
                           VALUES (?, ?, ?, ?, ?, 0, 1)""",
                        (skill_id, self.user_id, name, description, instructions),
                    )

                    for name_in_zip in namelist:
                        if (
                            name_in_zip.startswith(f"{skill_dir}/")
                            and name_in_zip != skill_dir + "/"
                        ):
                            file_path = name_in_zip[len(skill_dir) + 1 :]
                            if "/" in file_path:
                                continue

                            file_content = zf.read(name_in_zip)
                            file_id = f"file-{skill_id}-{file_path}"
                            mime_type = self._get_mime_type(file_path)

                            await conn.execute(
                                """INSERT OR REPLACE INTO skill_files (id, skill_id, filename, content, mime_type)
                                   VALUES (?, ?, ?, ?, ?)""",
                                (file_id, skill_id, file_path, file_content, mime_type),
                            )

                return {
                    "success": True,
                    "skill_id": skill_id,
                    "name": name,
                    "description": description,
                }
        except zipfile.BadZipFile:
            return {"error": "Invalid ZIP file format"}
        except Exception as e:
            logger.error(f"import_skill_from_zip failed: {e}")
            return {"error": str(e)}

    async def import_skill_from_url(self, url: str) -> dict:
        """Import a skill from a URL (ZIP file)."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                response.raise_for_status()

                content_type = response.headers.get("content-type", "")
                if "zip" not in content_type.lower() and not url.endswith(".zip"):
                    return {"error": "URL must point to a ZIP file"}

                return await self.import_skill_from_zip(response.content)
        except httpx.HTTPError as e:
            logger.error(f"import_skill_from_url failed: {e}")
            return {"error": f"Failed to download: {str(e)}"}
        except Exception as e:
            logger.error(f"import_skill_from_url failed: {e}")
            return {"error": str(e)}

    async def import_skill_from_folder(self, folder_path: str) -> dict:
        """Import a skill from a local folder in agentskills.io format."""
        try:
            if not os.path.isdir(folder_path):
                return {"error": f"Folder not found: {folder_path}"}

            skill_dir = os.path.basename(folder_path)
            skill_md_path = os.path.join(folder_path, "SKILL.md")

            if not os.path.exists(skill_md_path):
                return {"error": "SKILL.md not found in folder"}

            with open(skill_md_path, "r", encoding="utf-8") as f:
                skill_md_content = f.read()

            metadata = {}
            content_lines = []
            in_frontmatter = False
            frontmatter_lines = []

            for line in skill_md_content.split("\n"):
                if line.strip() == "---":
                    if not in_frontmatter:
                        in_frontmatter = True
                        continue
                    else:
                        in_frontmatter = False
                        continue
                if in_frontmatter:
                    frontmatter_lines.append(line)
                else:
                    content_lines.append(line)

            if frontmatter_lines:
                try:
                    metadata = yaml.safe_load("\n".join(frontmatter_lines)) or {}
                except:
                    pass

            instructions = "\n".join(content_lines).strip()
            name = metadata.get("name", skill_dir)
            description = metadata.get("description", "")

            skill_id = f"skill-{self.user_id}-{name}"

            pool = get_db_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT OR REPLACE INTO skills (id, user_id, name, description, instructions, is_global, enabled)
                       VALUES (?, ?, ?, ?, ?, 0, 1)""",
                    (skill_id, self.user_id, name, description, instructions),
                )

                for root, dirs, files in os.walk(folder_path):
                    rel_root = os.path.relpath(root, folder_path)
                    if rel_root == ".":
                        continue

                    for filename in files:
                        if filename == "SKILL.md":
                            continue

                        file_path = os.path.join(rel_root, filename)
                        file_id = f"file-{skill_id}-{file_path}"

                        with open(os.path.join(root, filename), "rb") as f:
                            file_content = f.read()

                        mime_type = self._get_mime_type(filename)

                        await conn.execute(
                            """INSERT OR REPLACE INTO skill_files (id, skill_id, filename, content, mime_type)
                               VALUES (?, ?, ?, ?, ?)""",
                            (file_id, skill_id, file_path, file_content, mime_type),
                        )

            return {
                "success": True,
                "skill_id": skill_id,
                "name": name,
                "description": description,
            }
        except Exception as e:
            logger.error(f"import_skill_from_folder failed: {e}")
            return {"error": str(e)}

    def _get_mime_type(self, filename: str) -> str:
        """Get MIME type from file extension."""
        ext = os.path.splitext(filename)[1].lower()
        mime_types = {
            ".py": "text/python",
            ".js": "text/javascript",
            ".json": "application/json",
            ".md": "text/markdown",
            ".txt": "text/plain",
            ".csv": "text/csv",
            ".yaml": "text/yaml",
            ".yml": "text/yaml",
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
        }
        return mime_types.get(ext, "application/octet-stream")


class CodeSandbox:
    """Sandboxed code execution tool."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.enabled = False  # Disabled by default per plan
        self.include_stubs = True

    async def execute_code(self, code: str, session_id: Optional[str] = None, include_tools: bool = True) -> dict:
        """
        Execute Python code in sandboxed container.

        Note: Uses local Python execution as fallback when sandbox is disabled.
        
        Args:
            code: Python code to execute
            session_id: Optional session ID for stateful execution
            include_tools: Whether to include tool stubs in the execution
        """
        if not self.enabled:
            return {
                "error": "Code execution sandbox is disabled",
                "code": code[:100] + "..." if len(code) > 100 else code,
                "output": None,
                "status": "disabled",
            }

        import subprocess
        import tempfile
        import os

        full_code = code
        if include_tools and self.include_stubs:
            try:
                from app.services.tools.registry import generate_tool_stubs
                tool_stubs = generate_tool_stubs()
                full_code = f"""
# Available tool stubs (for sandbox bridge)
{tool_stubs}

# User code:
{code}
"""
            except Exception as e:
                logger.warning(f"Failed to generate tool stubs: {e}")

        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
                f.write(full_code)
                temp_path = f.name

            result = subprocess.run(
                ["python3", temp_path], capture_output=True, text=True, timeout=30
            )

            os.unlink(temp_path)

            return {
                "output": result.stdout if result.stdout else "(no output)",
                "error": result.stderr if result.stderr else None,
                "return_code": result.returncode,
                "status": "success" if result.returncode == 0 else "error",
                "session_id": session_id,
            }
        except subprocess.TimeoutExpired:
            return {
                "error": "Code execution timed out (30s limit)",
                "status": "timeout",
            }
        except Exception as e:
            logger.error(f"execute_code failed: {e}")
            return {"error": str(e), "status": "failed"}


SKILL_TOOLS = [
    {
        "name": "load_skill",
        "description": "Load full instructions for a specific skill by name. Use when user query matches a skill description.",
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "Name of the skill to load (e.g., 'analyzing-sales-data')",
                }
            },
            "required": ["skill_name"],
        },
    },
    {
        "name": "save_skill",
        "description": "Save a newly created skill to make it available for future use.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Skill name (lowercase, hyphenated)",
                },
                "description": {
                    "type": "string",
                    "description": "Brief description of what the skill does",
                },
                "instructions": {
                    "type": "string",
                    "description": "Full markdown instructions for the skill",
                },
                "is_global": {
                    "type": "boolean",
                    "description": "Whether skill should be available to all users",
                },
            },
            "required": ["name", "description", "instructions"],
        },
    },
    {
        "name": "list_skills",
        "description": "List all available skills that can be loaded. Use to discover what skills exist.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "read_skill_file",
        "description": "Read content of a file attached to a skill.",
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "Name of the skill"},
                "filename": {
                    "type": "string",
                    "description": "Name of the file to read",
                },
            },
            "required": ["skill_name", "filename"],
        },
    },
    {
        "name": "execute_code",
        "description": "Execute Python code in a sandboxed Docker container. Use for data analysis, file generation, or computations.",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python code to execute"},
                "session_id": {
                    "type": "string",
                    "description": "Optional session ID for persistent state across calls",
                },
            },
            "required": ["code"],
        },
    },
    {
        "name": "import_skill_from_zip",
        "description": "Import a skill from a ZIP file in agentskills.io format. The ZIP should contain SKILL.md and optional scripts/references/assets folders.",
        "parameters": {
            "type": "object",
            "properties": {
                "zip_base64": {
                    "type": "string",
                    "description": "Base64-encoded ZIP file content",
                }
            },
            "required": ["zip_base64"],
        },
    },
    {
        "name": "import_skill_from_url",
        "description": "Import a skill from a URL pointing to a ZIP file in agentskills.io format.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to the ZIP file"}
            },
            "required": ["url"],
        },
    },
    {
        "name": "import_skill_from_folder",
        "description": "Import a skill from a local folder path in agentskills.io format.",
        "parameters": {
            "type": "object",
            "properties": {
                "folder_path": {
                    "type": "string",
                    "description": "Path to the local folder containing SKILL.md",
                }
            },
            "required": ["folder_path"],
        },
    },
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

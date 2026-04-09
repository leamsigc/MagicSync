import logging
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)

WORKSPACE_DIR = "/tmp/magicsync_workspace"


@dataclass
class WorkspaceFile:
    id: str
    thread_id: str
    user_id: str
    filename: str
    content: str
    mime_type: str
    created_at: int
    updated_at: int


class WorkspaceService:
    """Virtual filesystem for agent workspace."""

    def __init__(self, user_id: str):
        self.user_id = user_id

    def _get_user_workspace_dir(self, thread_id: str) -> str:
        """Get workspace directory for a thread."""
        workspace_dir = os.path.join(WORKSPACE_DIR, self.user_id, thread_id)
        os.makedirs(workspace_dir, exist_ok=True)
        return workspace_dir

    async def write_file(self, thread_id: str, filename: str, content: str, mime_type: str = "text/plain") -> dict:
        """Create or overwrite a file in the workspace."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                import time
                now = int(time.time())
                file_id = f"{thread_id}_{filename}"
                
                await conn.execute("""
                    INSERT OR REPLACE INTO workspace_files 
                    (id, thread_id, user_id, filename, content, mime_type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (file_id, thread_id, self.user_id, filename, content, mime_type, now, now))
                
                return {"success": True, "filename": filename, "file_id": file_id}
        except Exception as e:
            logger.error(f"Failed to write file: {e}")
            return {"error": str(e)}

    async def read_file(self, thread_id: str, filename: str) -> dict:
        """Read a file from the workspace."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """SELECT id, filename, content, mime_type FROM workspace_files 
                       WHERE thread_id = ? AND user_id = ? AND filename = ?""",
                    (thread_id, self.user_id, filename)
                )
                row = result.one_or_none()
                if not row:
                    return {"error": f"File '{filename}' not found"}
                
                return {
                    "file_id": row[0],
                    "filename": row[1],
                    "content": row[2],
                    "mime_type": row[3]
                }
        except Exception as e:
            logger.error(f"Failed to read file: {e}")
            return {"error": str(e)}

    async def edit_file(self, thread_id: str, filename: str, old_string: str, new_string: str) -> dict:
        """Edit a file using exact string replacement."""
        file_data = await self.read_file(thread_id, filename)
        if "error" in file_data:
            return file_data
        
        if old_string not in file_data["content"]:
            return {"error": f"String '{old_string}' not found in file"}
        
        new_content = file_data["content"].replace(old_string, new_string)
        return await self.write_file(thread_id, filename, new_content, file_data["mime_type"])

    async def list_files(self, thread_id: str) -> dict:
        """List all files in the workspace."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """SELECT id, filename, mime_type, created_at, updated_at FROM workspace_files 
                       WHERE thread_id = ? AND user_id = ? ORDER BY filename""",
                    (thread_id, self.user_id)
                )
                rows = result.all()
                
                files = [
                    {
                        "file_id": row[0],
                        "filename": row[1],
                        "mime_type": row[2],
                        "created_at": row[3],
                        "updated_at": row[4]
                    }
                    for row in rows
                ]
                return {"files": files, "count": len(files)}
        except Exception as e:
            logger.error(f"Failed to list files: {e}")
            return {"error": str(e)}

    async def delete_file(self, thread_id: str, filename: str) -> dict:
        """Delete a file from the workspace."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM workspace_files WHERE thread_id = ? AND user_id = ? AND filename = ?",
                    (thread_id, self.user_id, filename)
                )
                return {"success": True, "filename": filename}
        except Exception as e:
            logger.error(f"Failed to delete file: {e}")
            return {"error": str(e)}


class TodoService:
    """Todo list management for agent planning."""

    def __init__(self, user_id: str):
        self.user_id = user_id

    async def write_todos(self, thread_id: str, todos: list[dict]) -> dict:
        """Create or replace the todo list."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                import time
                now = int(time.time())
                
                await conn.execute(
                    "DELETE FROM agent_todos WHERE thread_id = ? AND user_id = ?",
                    (thread_id, self.user_id)
                )
                
                for idx, todo in enumerate(todos):
                    todo_id = f"{thread_id}_todo_{idx}"
                    content = todo.get("content", "")
                    status = todo.get("status", "pending")
                    
                    await conn.execute("""
                        INSERT INTO agent_todos 
                        (id, thread_id, user_id, content, status, order_index, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (todo_id, thread_id, self.user_id, content, status, idx, now, now))
                
                return {"success": True, "count": len(todos)}
        except Exception as e:
            logger.error(f"Failed to write todos: {e}")
            return {"error": str(e)}

    async def read_todos(self, thread_id: str) -> dict:
        """Read the current todo list."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """SELECT id, content, status, order_index FROM agent_todos 
                       WHERE thread_id = ? AND user_id = ? ORDER BY order_index""",
                    (thread_id, self.user_id)
                )
                rows = result.all()
                
                todos = [
                    {
                        "id": row[0],
                        "content": row[1],
                        "status": row[2],
                        "order": row[3]
                    }
                    for row in rows
                ]
                return {"todos": todos, "count": len(todos)}
        except Exception as e:
            logger.error(f"Failed to read todos: {e}")
            return {"error": str(e)}

    async def update_todo_status(self, thread_id: str, todo_id: str, status: str) -> dict:
        """Update a todo's status."""
        from app.core.db import get_db_pool
        
        try:
            pool = get_db_pool()
            async with pool.acquire() as conn:
                import time
                now = int(time.time())
                
                await conn.execute(
                    "UPDATE agent_todos SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?",
                    (status, now, todo_id, self.user_id)
                )
                return {"success": True, "todo_id": todo_id, "status": status}
        except Exception as e:
            logger.error(f"Failed to update todo: {e}")
            return {"error": str(e)}

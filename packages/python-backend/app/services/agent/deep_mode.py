import logging
from typing import Optional
from dataclasses import dataclass
from app.services.agent.workspace import WorkspaceService, TodoService
from app.services.agent.sub_agent import SubAgentService
from app.services.llm import llm_service

logger = logging.getLogger(__name__)

MAX_DEEP_ROUNDS = 50
MAX_SUB_AGENT_ROUNDS = 15


@dataclass
class DeepModeConfig:
    max_rounds: int = MAX_DEEP_ROUNDS
    max_sub_agent_rounds: int = MAX_SUB_AGENT_ROUNDS
    enable_workspace: bool = True
    enable_delegation: bool = True


class DeepModeAgent:
    """Autonomous agent with planning, workspace, and sub-agent delegation."""

    def __init__(self, user_id: str, thread_id: str, config: Optional[DeepModeConfig] = None):
        self.user_id = user_id
        self.thread_id = thread_id
        self.config = config or DeepModeConfig()
        
        self.workspace = WorkspaceService(user_id)
        self.todos = TodoService(user_id)
        self.sub_agent = SubAgentService(user_id)
        
        self.rounds = 0
        self.messages: list[dict] = []
        self.errors: list[dict] = []

    async def run(self, initial_task: str) -> dict:
        """Run the deep mode agent loop."""
        self.messages.append({
            "role": "user",
            "content": initial_task
        })
        
        while self.rounds < self.config.max_rounds:
            self.rounds += 1
            
            plan = await self._plan()
            if "error" in plan:
                self._log_error("planning", plan["error"])
                break
            
            execute_result = await self._execute(plan)
            if "complete" in execute_result:
                return execute_result
            
            evaluate_result = await self._evaluate(execute_result)
            if "complete" in evaluate_result:
                return evaluate_result
            
            if self.rounds >= self.config.max_rounds:
                return {
                    "status": "max_rounds",
                    "message": f"Reached maximum rounds ({self.config.max_rounds})",
                    "final_state": await self._get_state()
                }
        
        return {
            "status": "finished",
            "rounds": self.rounds,
            "final_state": await self._get_state()
        }

    async def _plan(self) -> dict:
        """Plan the next steps based on current state."""
        current_todos = await self.todos.read_todos(self.thread_id)
        workspace_files = await self.workspace.list_files(self.thread_id)
        
        prompt = f"""Current task: {self.messages[-1]['content']}

Current todo list: {current_todos.get('todos', [])}
Workspace files: {workspace_files.get('files', [])}

Previous errors: {self.errors[-5:] if self.errors else []}

Create a plan to complete this task. Output a JSON array of todos:
[{{"content": "step description", "status": "pending"}}]
"""
        response = await llm_service.chat([
            {"role": "system", "content": "You are an autonomous agent. Plan the next steps to complete the task."},
            {"role": "user", "content": prompt}
        ], json_mode=True)
        
        try:
            import json
            todos = json.loads(response)
            await self.todos.write_todos(self.thread_id, todos)
            return {"plan": "created", "todos": todos}
        except Exception as e:
            return {"error": f"Failed to create plan: {e}"}

    async def _execute(self, plan: dict) -> dict:
        """Execute the current plan."""
        todos = plan.get("todos", [])
        
        for todo in todos:
            if todo.get("status") == "completed":
                continue
            
            result = await self._execute_single_todo(todo)
            await self.todos.update_todo_status(self.thread_id, todo.get("id", ""), "in_progress")
            
            if "error" in result:
                self._log_error("execution", result["error"])
                continue
            
            if result.get("requires_user_input"):
                return {"status": "waiting_user", "question": result.get("question")}
        
        return {"status": "executed"}

    async def _execute_single_todo(self, todo: dict) -> dict:
        """Execute a single todo item."""
        content = todo.get("content", "")
        
        if self.config.enable_delegation and "delegate" in content.lower():
            return await self._delegate_task(content)
        
        if "write" in content.lower() and "file" in content.lower():
            return await self._handle_file_write(content)
        
        if "read" in content.lower() and "file" in content.lower():
            return await self._handle_file_read(content)
        
        if "ask" in content.lower() and "user" in content.lower():
            return await self._handle_ask_user(content)
        
        prompt = f"""Execute this task: {content}

Context:
- Workspace files available
- Todo list: {todo}

Execute and report the result."""

        response = await llm_service.chat([
            {"role": "system", "content": "You are executing a task from a todo list. Complete it and report the result."},
            {"role": "user", "content": prompt}
        ])
        
        await self.todos.update_todo_status(self.thread_id, todo.get("id", ""), "completed")
        return {"status": "completed", "result": response}

    async def _evaluate(self, execution_result: dict) -> dict:
        """Evaluate if the task is complete."""
        if execution_result.get("status") == "waiting_user":
            return {"status": "waiting_user", "question": execution_result.get("question")}
        
        current_todos = await self.todos.read_todos(self.thread_id)
        todos = current_todos.get("todos", [])
        
        pending = [t for t in todos if t.get("status") != "completed"]
        if not pending:
            return {"status": "complete", "result": "All tasks completed"}
        
        return {"status": "continue"}

    async def _delegate_task(self, task_description: str) -> dict:
        """Delegate work to a sub-agent."""
        _ = "general"
        if "code" in task_description.lower():
            _ = "coder"
        elif "research" in task_description.lower():
            _ = "researcher"
        
        parent_msg_id = f"deep-mode-{self.thread_id}"
        
        agent = self.sub_agent.spawn(
            task=task_description,
            parent_message_id=parent_msg_id,
            user_id=self.user_id,
            context=None,
            max_steps=self.config.max_sub_agent_rounds
        )
        
        self.sub_agent.start_agent(agent.id)
        
        return {
            "agent_id": agent.id,
            "status": agent.status.value,
            "task": task_description
        }

    async def _handle_file_write(self, content: str) -> dict:
        """Handle file write requests."""
        import json
        import re
        
        filename_match = re.search(r'filename[:\s]+["\']?([^"\'\s\n]+)', content, re.IGNORECASE)
        content_match = re.search(r'content[:\s]+(.+)$', content, re.IGNORECASE)
        
        if not filename_match:
            prompt = f"""Extract the filename and content from this request:
{content}

Output as JSON: {{"filename": "...", "content": "..."}}"""
            response = await llm_service.chat([
                {"role": "system", "content": "Extract structured data from text. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ], json_mode=True)
            try:
                parsed = json.loads(response)
                filename = parsed.get("filename")
                file_content = parsed.get("content", "")
            except Exception:
                return {"error": "Could not parse filename from request"}
        else:
            filename = filename_match.group(1)
            file_content = content_match.group(1) if content_match else ""
        
        result = await self.workspace.write_file(self.thread_id, filename, file_content)
        return {"status": "completed", "result": result}

    async def _handle_file_read(self, content: str) -> dict:
        """Handle file read requests."""
        import re
        
        filename_match = re.search(r'filename[:\s]+["\']?([^"\'\s\n]+)', content, re.IGNORECASE)
        
        if not filename_match:
            prompt = f"""Extract the filename from this request:
{content}

Output as JSON: {{"filename": "..."}}"""
            response = await llm_service.chat([
                {"role": "system", "content": "Extract structured data from text. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ], json_mode=True)
            import json
            try:
                parsed = json.loads(response)
                filename = parsed.get("filename")
            except Exception:
                return {"error": "Could not parse filename from request"}
        else:
            filename = filename_match.group(1)
        
        result = await self.workspace.read_file(self.thread_id, filename)
        if "error" in result:
            return {"error": result["error"]}
        return {"status": "completed", "content": result.get("content")}

    async def _handle_ask_user(self, content: str) -> dict:
        """Ask the user a question."""
        return {"status": "requires_user_input", "question": content}

    def _log_error(self, phase: str, error: str):
        """Log an error for tracking."""
        self.errors.append({
            "phase": phase,
            "error": error,
            "round": self.rounds
        })

    async def _get_state(self) -> dict:
        """Get current agent state."""
        todos = await self.todos.read_todos(self.thread_id)
        files = await self.workspace.list_files(self.thread_id)
        
        return {
            "rounds": self.rounds,
            "todos": todos.get("todos", []),
            "files": files.get("files", []),
            "errors": self.errors
        }


DEEP_MODE_TOOLS = [
    {
        "name": "write_todos",
        "description": "Create or replace your todo list. Use for planning complex tasks.",
        "parameters": {
            "type": "object",
            "properties": {
                "todos": {
                    "type": "array",
                    "description": "Array of todo objects with 'content' and optional 'status'",
                    "items": {
                        "type": "object",
                        "properties": {
                            "content": {"type": "string"},
                            "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]}
                        },
                        "required": ["content"]
                    }
                }
            },
            "required": ["todos"]
        }
    },
    {
        "name": "read_todos",
        "description": "Read your current todo list to check progress.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "write_file",
        "description": "Create or overwrite a file in your workspace.",
        "parameters": {
            "type": "object",
            "properties": {
                "filename": {"type": "string"},
                "content": {"type": "string"},
                "mime_type": {"type": "string", "default": "text/plain"}
            },
            "required": ["filename", "content"]
        }
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file in your workspace.",
        "parameters": {
            "type": "object",
            "properties": {
                "filename": {"type": "string"}
            },
            "required": ["filename"]
        }
    },
    {
        "name": "edit_file",
        "description": "Edit a file using exact string replacement.",
        "parameters": {
            "type": "object",
            "properties": {
                "filename": {"type": "string"},
                "old_string": {"type": "string"},
                "new_string": {"type": "string"}
            },
            "required": ["filename", "old_string", "new_string"]
        }
    },
    {
        "name": "list_files",
        "description": "List all files in your workspace.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "task",
        "description": "Delegate work to an isolated sub-agent.",
        "parameters": {
            "type": "object",
            "properties": {
                "description": {"type": "string"},
                "sub_agent_type": {"type": "string", "enum": ["general", "coder", "researcher"], "default": "general"}
            },
            "required": ["description"]
        }
    },
    {
        "name": "ask_user",
        "description": "Ask the user a question and wait for their response.",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {"type": "string"}
            },
            "required": ["question"]
        }
    }
]

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


class MCPClient:
    """Client for connecting to MCP (Model Context Protocol) servers."""

    def __init__(self):
        self._servers: dict[str, dict] = {}
        self._discovered_tools: dict[str, list[dict]] = {}
        self._initialize_servers()

    def _initialize_servers(self):
        """Initialize MCP servers from environment config."""
        mcp_servers = os.environ.get("MCP_SERVERS", "")
        
        if not mcp_servers:
            logger.info("No MCP servers configured")
            return
        
        for server_config in mcp_servers.split(","):
            parts = server_config.strip().split(":")
            if len(parts) >= 2:
                name = parts[0]
                command = parts[1]
                args = parts[2:] if len(parts) > 2 else []
                
                self._servers[name] = {
                    "command": command,
                    "args": args,
                    "status": "disconnected"
                }
                logger.info(f"Configured MCP server: {name}")

    async def connect(self, server_name: str) -> bool:
        """Connect to an MCP server."""
        if server_name not in self._servers:
            logger.warning(f"MCP server '{server_name}' not found")
            return False
        
        server = self._servers[server_name]
        
        try:
            server["status"] = "connected"
            logger.info(f"Connected to MCP server: {server_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MCP server '{server_name}': {e}")
            return False

    async def disconnect(self, server_name: str):
        """Disconnect from an MCP server."""
        if server_name in self._servers:
            self._servers[server_name]["status"] = "disconnected"
            logger.info(f"Disconnected from MCP server: {server_name}")

    async def discover_tools(self, server_name: str) -> list[dict]:
        """Discover tools available on an MCP server."""
        if server_name not in self._servers:
            return []
        
        if server_name in self._discovered_tools:
            return self._discovered_tools[server_name]
        
        try:
            tools = []
            self._discovered_tools[server_name] = tools
            return tools
        except Exception as e:
            logger.error(f"Failed to discover tools on '{server_name}': {e}")
            return []

    async def execute_tool(
        self,
        server_name: str,
        tool_name: str,
        arguments: dict
    ) -> dict:
        """Execute a tool on an MCP server."""
        if server_name not in self._servers:
            return {"error": f"Server '{server_name}' not configured"}
        
        if self._servers[server_name]["status"] != "connected":
            await self.connect(server_name)
        
        try:
            return {
                "server": server_name,
                "tool": tool_name,
                "result": "MCP execution stub - implement with MCP Python SDK"
            }
        except Exception as e:
            logger.error(f"MCP tool execution failed: {e}")
            return {"error": str(e)}

    def get_servers(self) -> list[dict]:
        """Get list of configured MCP servers."""
        return [
            {"name": name, **config}
            for name, config in self._servers.items()
        ]

    def get_available_tools(self) -> list[dict]:
        """Get all discovered tools across all servers."""
        all_tools = []
        for server_name, tools in self._discovered_tools.items():
            for tool in tools:
                all_tools.append({
                    "server": server_name,
                    **tool
                })
        return all_tools


mcp_client = MCPClient()


MCP_TOOL_DEFINITIONS = [
    {
        "name": "mcp_list_servers",
        "description": "List all configured MCP servers and their status.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "mcp_discover_tools",
        "description": "Discover available tools on an MCP server.",
        "parameters": {
            "type": "object",
            "properties": {
                "server_name": {
                    "type": "string",
                    "description": "Name of the MCP server"
                }
            },
            "required": ["server_name"]
        }
    },
    {
        "name": "mcp_execute",
        "description": "Execute a tool on an MCP server.",
        "parameters": {
            "type": "object",
            "properties": {
                "server_name": {
                    "type": "string",
                    "description": "Name of the MCP server"
                },
                "tool_name": {
                    "type": "string",
                    "description": "Name of the tool to execute"
                },
                "arguments": {
                    "type": "object",
                    "description": "Tool arguments as key-value pairs"
                }
            },
            "required": ["server_name", "tool_name"]
        }
    }
]
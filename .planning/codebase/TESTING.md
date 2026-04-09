# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Frameworks

### JavaScript/TypeScript (Nuxt packages)

**Framework:** Vitest
- Config: `packages/bulk-scheduler/vitest.config.ts`
- Test location: `packages/*/utils/__tests__/` or `packages/*/server/services/__tests__/`

**Configuration:**
```typescript
// packages/bulk-scheduler/vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    test: {
        environment: 'happy-dom',
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        globals: true,
        setupFiles: ['./tests/setup.ts']
    },
})
```

**Commands:**
```bash
pnpm --filter @local-monorepo/bulk-scheduler test        # Run all tests
pnpm --filter @local-monorepo/bulk-scheduler test:unit   # Run unit tests only
pnpm --filter @local-monorepo/bulk-scheduler test:coverage  # Run with coverage
```

### Python (Backend)

**Framework:** pytest
- Config: `packages/python-backend/pyproject.toml`
- Test location: `packages/python-backend/tests/`

**Dependencies:**
```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "ruff>=0.8.0",
]
```

**Run Commands:**
```bash
cd packages/python-backend
pytest                    # Run all tests
pytest tests/api/         # Run API tests only
pytest -v                 # Verbose output
```

## Test File Organization

### TypeScript/Vue Tests

**Location Patterns:**
- `packages/*/utils/__tests__/*.test.ts`
- `packages/*/server/services/__tests__/*.test.ts`

**Naming Convention:**
- `*.test.ts` for test files

**Example Structure:**
```
packages/bulk-scheduler/
├── utils/
│   ├── __tests__/
│   │   ├── csvParser.test.ts
│   │   ├── templateProcessor.test.ts
│   │   └── dateDistribution.test.ts
│   └── csvParser.ts
├── server/services/
│   ├── __tests__/
│   │   └── bulkScheduler.service.test.ts
│   └── bulkScheduler.service.ts
└── vitest.config.ts
```

### Python Tests

**Location:** `packages/python-backend/tests/`

**Structure:**
```
packages/python-backend/tests/
├── conftest.py              # Shared fixtures
├── api/
│   ├── test_chat.py
│   ├── test_security.py
│   ├── test_rag.py
│   └── test_health.py
├── services/
│   ├── test_pii.py
│   ├── test_knowledge_base.py
│   └── test_web_search.py
└── schemas/
    └── test_chat.py
```

## Test Structure Patterns

### Unit Test (Vitest)

```typescript
import { describe, it, expect, vi } from 'vitest'
import { parseCsvFile, validateCsvRow, csvRowToPost, type CsvRow } from '../csvParser'

describe('csvParser', () => {
    describe('validateCsvRow', () => {
        it('should validate a valid row', () => {
            const row: CsvRow = {
                content: 'Test post content',
                image_url: 'https://example.com/image.jpg',
                scheduled_time: '2026-01-15T10:00:00Z',
            }
            
            const errors = validateCsvRow(row, 1)
            expect(errors).toHaveLength(0)
        })
    })
})
```

### Service Test with Mocks

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bulkSchedulerService } from '../bulkScheduler.service'
import { postService } from '#layers/BaseDB/server/services/post.service'

vi.mock('#layers/BaseDB/server/services/post.service', () => ({
    postService: {
        create: vi.fn()
    }
}))

describe('BulkSchedulerService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('bulkCreateFromCsv', () => {
        it('should create posts and log success notification', async () => {
            vi.mocked(postService.create).mockResolvedValue({ data: { id: 'post-id' } } as any)
            
            const result = await bulkSchedulerService.bulkCreateFromCsv(userId, request)
            
            expect(result.success).toBe(true)
            expect(result.created).toBe(2)
        })
    })
})
```

### Python pytest

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

class TestChatEndpoints:
    def test_chat_stream_request_validation(
        self, client: TestClient, api_prefix: str, test_headers: dict
    ):
        async def mock_chat(*args, **kwargs):
            yield "Hello! How can I help you?"
        
        with patch(
            "app.services.llm.ollama.llm_service.chat",
            return_value=mock_chat(),
        ):
            response = client.post(
                f"{api_prefix}/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
                headers=test_headers,
            )
            assert response.status_code == 200
```

## Mocking Patterns

### Vitest Mocking

**Mock Service:**
```typescript
vi.mock('#layers/BaseDB/server/services/post.service', () => ({
    postService: {
        create: vi.fn(),
        getById: vi.fn()
    }
}))
```

**Mock Implementation:**
```typescript
vi.mocked(postService.create).mockResolvedValue({ data: { id: 'post-id' } } as any)
```

**Clear Mocks:**
```typescript
beforeEach(() => {
    vi.clearAllMocks()
})
```

### Python Mocking

**Mock with AsyncMock:**
```python
from unittest.mock import AsyncMock, patch

with patch(
    "app.services.llm.ollama.llm_service.chat",
    new_callable=AsyncMock,
    return_value=mock_response,
):
    response = client.post(...)
```

**Mock with yield (generators):**
```python
async def mock_chat(*args, **kwargs):
    yield "Hello! How can I help you?"

with patch(
    "app.services.llm.ollama.llm_service.chat",
    return_value=mock_chat(),
):
    response = client.post(...)
```

## Fixtures

### Python pytest Fixtures

**Location:** `packages/python-backend/tests/conftest.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def api_prefix():
    return "/api/v1"

@pytest.fixture
def test_jwt():
    """Provide a valid test JWT token."""
    return create_test_jwt()

@pytest.fixture
def test_headers(test_jwt):
    """Provide headers with valid JWT token."""
    return {"Authorization": f"Bearer {test_jwt}"}
```

## Test Types

### Unit Tests
- Focus on isolated functions and utilities
- Mock external dependencies
- Run fast with `vitest run`

### Integration Tests
- Test service layer interactions
- Use TestClient for API testing
- Located in `server/services/__tests__/`

### E2E Tests
- Use Playwright (configured in site package)
- Test user flows in browser
- Located in `packages/site/e2e/`

**Note:** E2E tests not yet fully configured in all packages.

## Coverage

### Vitest Coverage

```bash
# Run tests with coverage
pnpm test:coverage

# Coverage configured with v8 provider
coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
}
```

### Python Coverage

No coverage enforcement currently in place.

---

*Testing analysis: 2026-04-09*

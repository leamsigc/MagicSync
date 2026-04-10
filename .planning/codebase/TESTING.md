# Testing Patterns

**Analysis Date:** 2026-04-10

## Test Frameworks

### JavaScript/TypeScript (Nuxt packages)

**Framework:** Vitest
- Config: `packages/bulk-scheduler/vitest.config.ts`
- Test location: `packages/*/utils/__tests__/` or `packages/*/server/services/__tests__/`
- Setup file: `packages/bulk-scheduler/tests/setup.ts`

**Configuration:**
```typescript
// packages/bulk-scheduler/vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    plugins: [vue()],
    test: {
        environment: 'happy-dom',
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                '.playground/',
                '**/*.config.*',
                '**/dist/**',
                '**/*.d.ts',
                '**/__tests__/**',
                '**/e2e/**',
            ]
        },
        globals: true,
        setupFiles: ['./tests/setup.ts']
    },
    resolve: {
        alias: {
            '#layers/BaseDB': fileURLToPath(new URL('../db', import.meta.url)),
            '#layers/BaseAuth': fileURLToPath(new URL('../auth', import.meta.url)),
            '#layers/BaseUI': fileURLToPath(new URL('../ui', import.meta.url)),
            '#layers/BaseScheduler': fileURLToPath(new URL('../scheduler', import.meta.url)),
            '~': fileURLToPath(new URL('./app', import.meta.url)),
            '@': fileURLToPath(new URL('./app', import.meta.url)),
        }
    }
})
```

**Test Setup (globals):**
```typescript
// packages/bulk-scheduler/tests/setup.ts
import { vi } from 'vitest'

global.useI18n = vi.fn(() => ({
    t: (key: string) => key,
    locale: { value: 'en' }
}))

global.useToast = vi.fn(() => ({
    add: vi.fn()
}))

global.$fetch = vi.fn()

global.useState = vi.fn((key: string, init?: () => any) => {
    const value = init ? init() : undefined
    return { value }
})
```

**Run Commands:**
```bash
pnpm --filter @local-monorepo/bulk-scheduler test        # Run all tests
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
- `packages/*/utils/__tests__/*.test.ts` - Utility tests
- `packages/*/server/services/__tests__/*.test.ts` - Service tests
- `packages/*/tests/e2e/*.spec.ts` - E2E tests (Playwright)

**Naming Convention:**
- `*.test.ts` for unit/integration tests
- `*.spec.ts` for E2E tests

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
├── tests/
│   ├── setup.ts
│   └── e2e/
│       ├── bulk-generate.spec.ts
│       └── csv-import.spec.ts
└── vitest.config.ts
```

### E2E Tests (Playwright)

**Location:** `packages/*/tests/e2e/*.spec.ts`

**Examples:**
- `packages/ai-tools/tests/e2e/chat-page.spec.ts`
- `packages/ai-tools/tests/e2e/metadata-extraction.spec.ts`
- `packages/tools/tests/e2e/image-editor.spec.ts`
- `packages/site/tests/e2e/ai-tools-chat.spec.ts`
- `packages/bulk-scheduler/tests/e2e/csv-import.spec.ts`

**Note:** E2E tests use Playwright but configuration is in site package.

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
// packages/bulk-scheduler/utils/__tests__/csvParser.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseCsvFile, validateCsvRow, csvRowToPost, type CsvRow } from '../csvParser'

describe('csvParser', () => {
    describe('validateCsvRow', () => {
        it('should validate a valid row', () => {
            const row: CsvRow = {
                content: 'Test post content',
                image_url: 'https://example.com/image.jpg',
                scheduled_time: '2026-01-15T10:00:00Z',
                comments: 'First comment;Second comment'
            }
            
            const errors = validateCsvRow(row, 1)
            expect(errors).toHaveLength(0)
        })

        it('should return error for empty content', () => {
            const row: CsvRow = {
                content: '',
                image_url: 'https://example.com/image.jpg'
            }

            const errors = validateCsvRow(row, 1)
            expect(errors).toHaveLength(1)
            expect(errors[0]).toContain('Content is required')
        })
    })
})
```

### Service Test with Mocks

```typescript
// packages/bulk-scheduler/server/services/__tests__/bulkScheduler.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bulkSchedulerService } from '../bulkScheduler.service'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

vi.mock('#layers/BaseDB/server/services/post.service', () => ({
    postService: {
        create: vi.fn()
    }
}))

vi.mock('#layers/BaseAuth/server/services/notification.service', () => ({
    notificationService: {
        createNotification: vi.fn()
    }
}))

describe('BulkSchedulerService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('bulkCreateFromCsv', () => {
        it('should create posts and log success notification', async () => {
            const userId = 'user-1'
            const posts = [{ content: 'Post 1' }, { content: 'Post 2' }] as any
            const request = {
                posts,
                platforms: ['facebook'],
                businessId: 'biz-1'
            }

            vi.mocked(postService.create).mockResolvedValue({ data: { id: 'post-id' } } as any)

            const result = await bulkSchedulerService.bulkCreateFromCsv(userId, request)

            expect(result.success).toBe(true)
            expect(result.created).toBe(2)
            expect(notificationService.createNotification).toHaveBeenCalledWith(
                userId,
                expect.objectContaining({
                    type: 'success',
                    title: 'CSV Import Successful'
                })
            )
        })

        it('should handle partial failures and log warning notification', async () => {
            const userId = 'user-1'
            const posts = [{ content: 'Post 1' }, { content: 'Post 2' }] as any
            const request = {
                posts,
                platforms: ['facebook'],
                businessId: 'biz-1'
            }

            vi.mocked(postService.create)
                .mockResolvedValueOnce({ data: { id: 'post-id' } } as any)
                .mockResolvedValueOnce({ error: 'Failed to create' } as any)

            const result = await bulkSchedulerService.bulkCreateFromCsv(userId, request)

            expect(result.success).toBe(false)
            expect(result.created).toBe(1)
            expect(result.failed).toBe(1)
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

### Vitest Global Setup

The setup file `packages/bulk-scheduler/tests/setup.ts` provides global mocks:
- `useI18n` - Mock for internationalization
- `useToast` - Mock for toast notifications
- `$fetch` - Mock for API calls
- `useState` - Mock for Nuxt state

## Test Types

### Unit Tests
- Focus on isolated functions and utilities
- Located in `utils/__tests__/`
- Mock external dependencies
- Run fast with `vitest run`

### Integration Tests
- Test service layer interactions
- Located in `server/services/__tests__/`
- Mock database and other services
- Test ServiceResponse patterns

### E2E Tests
- Use Playwright (configured in site package)
- Test user flows in browser
- Located in `packages/*/tests/e2e/`
- Cover 14 packages: site, ui, db, auth, scheduler, ai-tools, email, connect, content, templates, assets, bulk-scheduler, tools, doc

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

*Testing analysis: 2026-04-10*
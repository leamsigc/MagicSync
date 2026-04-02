# Candidate: PII Redaction & Anonymization

## Status
`pending`

## Priority
High

## Episode
Episode 3 of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep3-redaction-anonymization-video)

## Source
Adapted from [PRD-PII-Redaction-System.md](https://github.com/theaiautomators/claude-code-agentic-rag-series/blob/main/ep3-redaction-anonymization-video/PRD-PII-Redaction-System.md)

## Core Principle

```
User sees REAL data <--[de-anonymize]--> Database stores REAL data --[anonymize on-the-fly]--> Cloud LLM sees FAKE data
```

- Documents stored with original content
- Embeddings generated locally (Ollama — no PII sent to remote)
- Anonymization happens at chat time, not ingestion
- De-anonymization before data reaches user

## What It Is

A PII redaction system using Microsoft Presidio for NER-based detection, Faker for reversible surrogates, and irreversible `[TYPE]` placeholders for sensitive entities. Entity resolution clusters name variants. The user never sees fake data. The cloud LLM never sees real data.

## Functional Requirements

### Detection (Two-Pass)
- **Surrogate entities** (high threshold 0.7): PERSON, EMAIL, PHONE, LOCATION, DATE_TIME, URL, IP_ADDRESS
- **Hard-redact entities** (low threshold 0.3): CREDIT_CARD, SSN, ITIN, BANK_NUMBER, IBAN, CRYPTO, PASSPORT, DRIVER_LICENSE
- UUID post-filter (prevent corruption of document IDs)

### Anonymization
- Surrogate types → Faker-generated realistic fakes (gender-matched)
- Hard-redact types → `[ENTITY_TYPE]` placeholders
- Collision-free surrogate generation
- Programmatic string replacement (not LLM-generated)

### Entity Resolution (3 modes)
- **Algorithmic**: name parsing + Union-Find clustering + nickname resolution
- **LLM**: local Ollama inference for clustering
- **None**: direct 1:1 mapping

### De-Anonymization
- Placeholder-based pipeline (3-phase: placeholders → fuzzy → real values)
- Case-insensitive matching
- Fuzzy pass for LLM-reformatted names

### Pipeline Coverage
- Main chat (anonymize input, buffer output, de-anonymize)
- Sub-agents (suppress reasoning events, buffer results)
- Tool calls (de-anonymize SQL, anonymize results)
- Title generation (prefer local LLM)

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENTITY_RESOLUTION_MODE` | `llm` | `llm`, `algorithmic`, or `none` |
| `PII_SURROGATE_ENTITIES` | `PERSON,EMAIL_ADDRESS,PHONE_NUMBER,LOCATION,DATE_TIME,URL,IP_ADDRESS` | Reversible types |
| `PII_REDACT_ENTITIES` | `CREDIT_CARD,US_SSN,US_ITIN,US_BANK_NUMBER,IBAN_CODE,CRYPTO` | Irreversible types |
| `PII_SURROGATE_SCORE_THRESHOLD` | `0.7` | Confidence for surrogates |
| `PII_REDACT_SCORE_THRESHOLD` | `0.3` | Confidence for hard redaction |
| `PII_MISSED_SCAN_ENABLED` | `true` | Secondary LLM scan |

## Cluster

- `packages/python-backend/app/services/privacy/` — PII detection, anonymization, entity resolution
- `packages/python-backend/app/api/v1/privacy.py` — Redaction API endpoints
- `packages/python-backend/pyproject.toml` — presidio, spacy, faker, nameparser, rapidfuzz, gender-guesser
- `packages/db/db/privacy/` — Entity registry schema
- `packages/db/server/services/privacy.service.ts` — Registry persistence
- `packages/ai-tools/app/pages/app/ai-tools/privacy/` — Settings UI

## Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase | Turso (libSQL) |
| React | Nuxt 4 + Vue 3 |
| FastAPI | FastAPI (same) |
| LM Studio | Ollama (existing) |

## Implementation Phases

### Phase 1: Detection Service
- TDD: Tests for Presidio detection, two-pass thresholds, UUID filter
- Add dependencies to pyproject.toml
- Implement PiiDetectionService with Presidio + spaCy
- UUID post-filter

### Phase 2: Anonymization Engine
- TDD: Tests for surrogate generation, collision avoidance, gender matching
- Implement AnonymizationEngine with Faker
- Conversation-scoped entity registry (DB schema + service)
- 3-phase de-anonymization pipeline

### Phase 3: Entity Resolution
- TDD: Tests for algorithmic and LLM modes
- Algorithmic: nameparser + Union-Find + nickname dictionary
- LLM: Ollama local inference for clustering
- Configurable via ENTITY_RESOLUTION_MODE

### Phase 4: Pipeline Integration
- TDD: Tests for chat, sub-agent, tool call integration
- Pre-LLM anonymization hook in Python backend
- Post-LLM de-anonymization hook
- Buffer-and-de-anonymize for sub-agents
- System prompt guidance for surrogate formatting

### Phase 5: Frontend
- Privacy settings page (entity types, thresholds, resolution mode)
- Visual indicator when redaction is active in chat
- SSE status events (anonymizing, de-anonymizing)

## Dependencies

| Component | Purpose |
|-----------|---------|
| presidio-analyzer + presidio-anonymizer | NER detection engine |
| spacy (en_core_web_trf) | NER model backend |
| faker | Surrogate generation |
| nameparser | Name component parsing |
| nicknames | Nickname → canonical resolution |
| rapidfuzz | Jaro-Winkler similarity |
| gender-guesser | Gender-matched surrogates |

## Reference Links

- **Episode 3 PRD:** https://github.com/theaiautomators/claude-code-agentic-rag-series/blob/main/ep3-redaction-anonymization-video/PRD-PII-Redaction-System.md
- **Episode 3 README:** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep3-redaction-anonymization-video
- **Full Series:** https://github.com/theaiautomators/claude-code-agentic-rag-series

## Python Backend Dependencies

Add to `packages/python-backend/pyproject.toml`:
```toml
[project.optional-dependencies]
privacy = [
    "presidio-analyzer>=2.2.0",
    "presidio-anonymizer>=2.2.0",
    "spacy>=3.7.0",
    "faker>=24.0.0",
    "nameparser>=1.1.0",
    "rapidfuzz>=3.6.0",
    "gender-guesser>=0.4.0",
]
```

After adding: `cd packages/python-backend && pnpm add presidio-analyzer presidio-anonymizer spacy faker nameparser rapidfuzz gender-guesser`
Then: `python -m spacy download en_core_web_trf`

## Privacy Service Structure (Python)

```
packages/python-backend/app/services/privacy/
├── __init__.py
├── pii_detection.py      # Presidio-based detection
├── anonymization.py      # Faker surrogate generation
├── entity_resolution.py  # Name clustering
├── deanonymization.py    # Reverse mapping
└── pipeline.py           # Full anonymize→LLM→deanonymize flow
```

## Optimized System Prompt (for PII Redaction)

```
IMPORTANT: All user messages are anonymized before processing.
- Names are replaced with realistic fake names (gender-matched)
- Emails/phones replaced with valid-format fakes
- SSNs, credit cards replaced with [CREDIT_CARD], [SSN] placeholders
- When responding, use the fake names as they appear in the context
- The system will de-anonymize your response before showing to user
- Do NOT mention that data has been anonymized
```

---
*Adapted: 2026-03-31*

# Candidate: PII Redaction & Anonymization

## Status
`pending`

## Priority
High

## Episode
Episode 3 of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series)

## Cluster

- `packages/python-backend/app/services/privacy/` — PII detection and redaction
- `packages/python-backend/app/services/rag/` — Integration with ingestion pipeline
- `packages/python-backend/app/api/v1/` — Redaction API endpoints
- `packages/db/db/rag/` — Redaction audit log schema
- `packages/ai-tools/app/pages/app/ai-tools/` — Privacy settings UI

## Problem Statement

Users upload business documents containing PII (names, emails, phone numbers, addresses, SSNs). When these documents are sent to cloud LLMs, sensitive data leaves the local environment. There is no privacy layer.

### Current Friction
- Document chunks sent to LLM contain raw PII
- No anonymization before cloud API calls
- No way to configure redaction rules per user
- Compliance risk for business documents

## Why Coupled

1. PII detection must intercept data at the RAG pipeline boundary
2. Anonymization needs to be reversible (de-anonymize responses)
3. Entity resolution clusters name variants ("Danny", "Daniel Walsh")
4. Must work across chat, sub-agents, and tool calls

## Dependency Category

- Cross-cutting: Affects all LLM interactions

## Test Impact

**Currently:**
- 171 Python tests, no privacy tests

**After consolidation:**
- Tests for NER-based PII detection (Presidio)
- Tests for reversible anonymization with Faker surrogates
- Tests for hard redaction (SSN, credit cards)
- Tests for entity resolution clustering
- Tests for pipeline integration (chat, retrieval, tools)

## Proposed Solution

A PII redaction system that sits between the app and cloud LLMs:

### Modules

#### Module 1: PII Detection Service
- Microsoft Presidio for NER-based detection
- spaCy NLP model for entity recognition
- Custom pattern matchers for MagicSync-specific PII
- Configurable entity types (PERSON, EMAIL, PHONE, SSN, etc.)

#### Module 2: Anonymization Engine
- Reversible anonymization with Faker-generated surrogates
- Hard redaction for highly sensitive types (SSN, credit cards)
- Entity mapping (real → fake) stored per-session
- De-anonymization of LLM responses

#### Module 3: Entity Resolution
- Name variant clustering ("Danny" → "Daniel Walsh")
- rapidfuzz for fuzzy matching
- gender-guesser for consistent surrogate generation
- Local LLM for ambiguous entity resolution

#### Module 4: Pipeline Integration
- Pre-LLM hook: anonymize all text before sending to cloud
- Post-LLM hook: de-anonymize responses
- Configurable per-user: local-only, cloud-with-redaction, cloud-raw
- Audit log of all redaction events

#### Module 5: Frontend
- Privacy settings page (redaction level, entity types)
- Visual indicator when redaction is active
- Document preview showing detected PII

## Tech Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase | Turso (libSQL) |
| React | Nuxt 4 + Vue 3 |
| Presidio + spaCy | Same (Python) |
| Faker | Same (Python) |

## Next Steps

1. Add presidio, spacy, faker, nameparser, rapidfuzz, gender-guesser to pyproject.toml
2. Write TDD tests for PII detection
3. Implement PiiDetectionService
4. Implement AnonymizationEngine with reversible mapping
5. Add pre/post LLM hooks to chat and RAG pipeline
6. Build privacy settings UI

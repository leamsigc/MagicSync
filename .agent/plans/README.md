# Architecture Improvement Plans

This directory contains RFC candidates for deepening modules and improving codebase architecture.

## Candidates

| # | Name | Status | Priority |
|---|------|--------|----------|
| 1 | Social Publishing Module | `completed` | High |
| 2 | Post Creation Flow Consolidation | `completed` | High |
| 3 | Auth/Account Type Consolidation | `completed` | Medium |
| 4 | API Route → Service Layer Boundary | `completed` | Medium |
| 5 | Agentic RAG Layer | `pending` | High |

## Current Focus: Agentic RAG Layer

We are implementing an Agentic RAG layer with these modules:
- Module 1: App Shell + Observability
- Module 2: BYO Retrieval + Memory
- Module 3: Record Manager
- Module 4: Metadata Extraction
- Module 5: Multi-Format Support
- Module 6: Hybrid Search & Reranking
- Module 7: Additional Tools
- Module 8: Sub-Agents

See `.agent/plans/candidates/05-agentic-rag-layer.md` for full PRD.

## How to Use

1. Review candidates in `candidates/` directory
2. Each candidate has a detailed PRD
3. Pick a candidate to implement by creating a sub-plan
4. Execute with `/build` command

## Adding New Candidates

Run the architecture exploration to identify new candidates:
```
/improve-codebase-architecture
```

## Progress

See `PROGRESS.md` in root directory for detailed module progress.

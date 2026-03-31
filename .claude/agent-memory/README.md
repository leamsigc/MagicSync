# Agent Memory — Episode Planning

This directory contains planning artifacts for each episode of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series), adapted for MagicSync's Nuxt 4 + FastAPI + Turso stack.

## Structure

Each episode has its own directory with planning files:

```
agent-memory/
  ep2-knowledge-base/
    PROJECT.md      # What we're building, requirements, constraints
    REQUIREMENTS.md  # Detailed requirements with traceability
    ROADMAP.md      # Phased development plan with tasks
    STATE.md        # Current progress and session continuity
```

## Episodes

| Episode | Directory | Status |
|---------|-----------|--------|
| Ep 2: Knowledge Base Explorer | `ep2-knowledge-base/` | Planning complete |
| Ep 3: PII Redaction | See `.agent/plans/candidates/07-pii-redaction.md` | Candidate |
| Ep 4: Agent Skills & Sandbox | See `.agent/plans/candidates/08-agent-skills-sandbox.md` | Candidate |
| Ep 5: Advanced Tool Use | See `.agent/plans/candidates/09-advanced-tool-use.md` | Candidate |
| Ep 6: Agent Harness | See `.agent/plans/candidates/10-agent-harness.md` | Candidate |

## How to Activate an Episode

1. Move the candidate plan to `.agent/plans/active/`
2. Create the episode directory here with full planning artifacts
3. Start Phase 1 with TDD

## Source

All planning content adapted from:
https://github.com/theaiautomators/claude-code-agentic-rag-series

---
*Last updated: 2026-03-31*

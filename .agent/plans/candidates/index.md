# Candidates Index

| # | File | Priority | Status | Source |
|---|------|----------|--------|--------|
| 1 | [01-social-publishing-module.md](./01-social-publishing-module.md) | High | `completed` | Architecture |
| 2 | [02-post-creation-flow.md](./02-post-creation-flow.md) | High | `completed` | Architecture |
| 3 | [03-auth-account-consolidation.md](./03-auth-account-consolidation.md) | Medium | `completed` | Architecture |
| 4 | [04-api-service-boundary.md](./04-api-service-boundary.md) | Medium | `completed` | Architecture |
| 5 | [05-agentic-rag-layer.md](../active/05-agentic-rag-layer.md) | High | `completed` | Episode 1 |
| 6 | [06-knowledge-base-explorer.md](./06-knowledge-base-explorer.md) | High | `pending` | Episode 2 |
| 7 | [07-pii-redaction.md](./07-pii-redaction.md) | High | `pending` | Episode 3 |
| 8 | [08-agent-skills-sandbox.md](./08-agent-skills-sandbox.md) | High | `pending` | Episode 4 |
| 9 | [09-advanced-tool-use.md](./09-advanced-tool-use.md) | Medium | `pending` | Episode 5 |
| 10 | [10-agent-harness.md](./10-agent-harness.md) | High | `pending` | Episode 6 |

## Episode Series

Candidates 6-10 are adapted from the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series) for our Nuxt 4 + FastAPI + Turso stack.

## How to Pick a Candidate

Run architecture exploration:
```
/improve-codebase-architecture
```

Review candidates and pick one to implement. To activate a candidate:

```bash
mv candidates/<id>-*.md active/
```

Then run the design workflow to create interfaces and RFC.

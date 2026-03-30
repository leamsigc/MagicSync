# Candidates Index

| # | File | Priority | Status |
|---|------|----------|--------|
| 1 | [01-social-publishing-module.md](./01-social-publishing-module.md) | High | `pending` |
| 2 | [02-post-creation-flow.md](./02-post-creation-flow.md) | High | `pending` |
| 3 | [03-auth-account-consolidation.md](./03-auth-account-consolidation.md) | Medium | `pending` |
| 4 | [04-api-service-boundary.md](./04-api-service-boundary.md) | Medium | `pending` |

## How to Pick a Candidate

Run architecture exploration:
```
/improve-codebase-architecture
```

Review candidates and pick one to implement. To activate a candidate:

```bash
mv candidates/<id>-*.md active/<id>-<name>/
```

Then run the design workflow to create interfaces and RFC.

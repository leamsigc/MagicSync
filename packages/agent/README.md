# @local-monorepo/agent

Nuxt layer that runs the MagicSync agent platform **in-process** with the
[pi SDK](https://www.npmjs.com/package/@earendil-works/pi-coding-agent). No
Python, no child processes: the site server hosts chat, tools, workflows, RAG,
PII filtering, and video ingestion directly.

## What's inside

| Area | Files |
|---|---|
| Chat API | `server/api/v1/agent/chat.post.ts` (SSE), `tools.get.ts`, `sessions*.ts`, `runs.get.ts` |
| Board API | `server/api/v1/content-items/*` (list/create/move/actions/batch) |
| Runner | `server/services/agent-runner.service.ts` — session build, event normalization (`§3.2` contract), limits, persistence, `agent_runs` rows |
| Sessions | `server/services/agent-session.service.ts` — durable pi entries in `agent_chat_entries` with monotonic `seq` |
| Workflows | `server/services/agent-workflow.service.ts` — `trend_scan`, `content_chain`, board batch |
| Chain | `server/services/content-chain.service.ts` — research → write → humanize → SEO/GEO/link checks → review artifact |
| Tools | `server/agent/tools/*` — board, research, content, media (yt-dlp), delivery, skills, ScrapeGraphAI, Python proxy |
| Runtime | `server/utils/pi-runtime.ts` (ModelRuntime, per-run keys/base URLs), `run-config.ts` (effective model + Brand Playbook context) |
| RAG | `server/utils/embeddings.ts` + `packages/db/server/services/document-ingest.service.ts` |
| PII | `server/utils/pii.ts` (regex + ONNX NER, fail-closed), `services/pii-mapping.service.ts` |
| Video | `server/utils/ytdlp.ts` (array args, temp dirs, cleanup) |
| Tool backends | `server/utils/scrapegraph.ts` (default scraper), `server/utils/python-tools.ts` (sidecar proxy) |

The content board UI lives in `packages/connect/app/pages/app/business/[id]/content.vue`;
the chat UI in `packages/ai-tools/app/pages/app/chat/`.

## Commands

```bash
pnpm --filter @local-monorepo/agent test        # node:test suites, no network/API keys
pnpm --filter @local-monorepo/agent dev:prepare # Nuxt prepare for the layer playground
pnpm python-tools:dev                            # optional Python tools sidecar (port 8100)
```

## Configuration

- **Models:** per-business provider/model/key via AI settings; `server/agent/models.json`
  is the deployment template (Ollama, DeepSeek, OpenRouter); `AGENT_DEFAULT_PROVIDER`/
  `AGENT_DEFAULT_MODEL` act as fallbacks. `PI_OFFLINE=1` keeps catalogs local.
- **Limits:** `AGENT_MAX_TURNS`, `AGENT_MAX_TOOL_CALLS`, `AGENT_TOKEN_BUDGET`,
  `AGENT_TOOL_TIMEOUT_MS`, `AGENT_MAX_CONCURRENCY`.
- **Scraping:** ScrapeGraphAI key in AI settings (fallback `SGAI_API_KEY`);
  `scrape_url` falls back to raw fetch with a warning.
- **Python tools:** URL/token in AI settings (fallback `PYTHON_TOOLS_URL`/`PYTHON_TOOLS_TOKEN`);
  see `packages/python-tools/README.md`.
- **PII:** `scripts/pii_assets.sh` downloads the pinned ONNX NER model;
  `PII_MODEL_PATH` overrides the directory; private mode fails closed without it
  (`PII_ALLOW_REGEX_ONLY=1` is the documented escape hatch — see context docs).

## Test seams

- `tests/stub-provider.mjs` — OpenAI-compatible SSE stub (scripted tool calls + text)
- `tests/stub-models.mjs` — models.json pointing at the stub
- Tool context injectables: `scrapegraph` (fake client), `validateUrl` (SSRF bypass),
  `complete` (deterministic completions), `embed` (deterministic embeddings)

See `.claude/patterns/pi-agent-layer.md` and
`.claude/patterns/tool-backend-settings.md` for the full patterns.

# Agent Platform

MagicSync includes a per-business **agent platform** that plans, researches, drafts, and checks content — with humans approving everything before it goes out.

Agents run **inside the Nuxt server** using the [pi SDK](https://www.npmjs.com/package/@earendil-works/pi-coding-agent). There is no separate AI backend service to deploy.

---

## Business Chat

One chat surface does everything: pick a business, then work with tools, skills, and predefined workflows in plain language.

- Open **AI Tools → Chat** and select the active business from the header.
- Messages stream over Server-Sent Events with stable IDs, so reconnects and replays never duplicate chunks.
- Every reply is grounded in the business's **current Brand Playbook edition** (identity, voice, audience, offers, keywords).
- Tool activity renders inline (started / progress / finished) and artifacts open as cards next to the conversation.

### Streaming contract

Each event carries a stable `id` (`<runId>:<seq>`):

| Event | Meaning |
|---|---|
| `message.started` | Assistant turn began |
| `thinking.delta` / `text.delta` | Streaming reasoning / text |
| `tool.started` / `tool.progress` / `tool.finished` | Tool lifecycle |
| `artifact.created` / `review.required` | A draft is ready for review |
| `message.completed` | Turn finished (includes session + thread IDs) |
| `error` | Typed failure code (never silent) |

---

## Models

Each business chooses its own provider, model, and key in **Account → AI settings** (or a per-business override).

| Provider | Notes |
|---|---|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, … |
| Anthropic | Claude models |
| Google | Gemini models |
| OpenRouter | Any OpenRouter model id |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` |
| Ollama | Local models via an OpenAI-compatible endpoint (`http://localhost:11434/v1`) |

- API keys are encrypted at rest and only decrypted into memory per run.
- A failed provider auth surfaces to the user — there is **no silent model fallback**.
- Deployment-wide defaults: `AGENT_DEFAULT_PROVIDER` / `AGENT_DEFAULT_MODEL`.
- Local model routing is configured by the deployment template at `packages/agent/server/agent/models.json`.

---

## Tools

Tools are server-owned, typed, and tenant-scoped. The model can never pick a business or user — those come from the authenticated session, and vendor arguments that try to override them are ignored.

| Group | Tools |
|---|---|
| Board | `board_list`, `board_add_cards`, `board_move`, `board_update` |
| Research | `scan_trends`, `scrape_url`, `scrapegraph_scrape`, `scrapegraph_extract`, `scrapegraph_search`, `scrapegraph_credits`, `research_topic`, `retrieve` |
| Content | `write_post`, `humanize`, `apply_template`, `check_seo`, `check_geo`, `check_links` |
| Media | `download_video`, `design_fabric`, `create_carousel`, `create_reel_storyboard` |
| Delivery | `create_post`, `schedule_post`, `publish` |
| Skills | `list_skills`, `load_skill`, `save_skill` |
| Python | `python_tools_list`, `python_tool_run` |

Built-in shell, file, and network tools are **excluded** — the agent can only use the catalog above. See [Tool Backends](/guide/tool-backends) for the scraper and Python tools configuration.

---

## Knowledge (RAG)

Upload documents for the agent to retrieve from:

- Supported formats: text, Markdown, PDF (`unpdf`), DOCX (`mammoth`).
- Documents are chunked, hashed for dedupe, and embedded with the business's embedding provider.
- Search runs natively in Turso (`vector_distance_cos`) and is scoped to the user.
- The model reaches it through the `retrieve` tool.

---

## PII Private Mode

When private mode is on, the agent keeps personal data out of provider requests:

1. Emails, phones, IBANs, card numbers (regex) and names/orgs/locations (ONNX NER) are replaced with surrogates like `[EMAIL_1]`.
2. Only surrogates are sent to the model.
3. Output is restored to the real values while streaming (surrogate boundaries are never split).
4. Surrogate → value maps are stored per conversation in `pii_mappings`.

Private mode is **fail-closed**: without the ONNX model it refuses to send. Install the model with:

```bash
bash ./scripts/pii_assets.sh   # downloads the pinned NER model
```

`PII_ALLOW_REGEX_ONLY=1` is an explicit, non-default escape hatch for regex-only anonymization.

---

## Video Ingestion

The `download_video` tool fetches source video for reels and storyboards using pinned CLI binaries:

- `yt-dlp` musllinux binary + `ffmpeg` are included in the Docker image.
- URLs are SSRF-checked (public http/https only) and downloads land in a per-run temp directory that is always cleaned up.
- Hard caps: `--no-playlist`, `--restrict-filenames`, `--max-filesize 200M`, `--merge-output-format mp4`.
- Results are stored in the business asset library.

---

## Limits

Runs are bounded so a chat can never spin forever:

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_MAX_TURNS` | `12` | Max model turns per run |
| `AGENT_MAX_TOOL_CALLS` | `40` | Max tool calls per run |
| `AGENT_TOKEN_BUDGET` | `200000` | Token ceiling |
| `AGENT_TOOL_TIMEOUT_MS` | `60000` | Per-tool timeout |
| `AGENT_MAX_CONCURRENCY` | `3` | Parallel tool execution |

Exceeded limits mark the run failed with the reason recorded in the oversight feed.

---

## Safety Model

- **Tenant isolation** — `businessId`/`userId` are resolved server-side per request, never from model arguments.
- **Approval gates** — agents can move a card up to *review required*; only a human-approved artifact can be scheduled or published.
- **No secrets in context** — the Brand Playbook prompt is redacted and framed as untrusted data; credentials are never included.
- **Truthful telemetry** — every run writes an `agent_runs` row (status, tokens, duration, tool events), visible in the board's activity feed.

---

## Next Steps

- [Content Board](/guide/content-board) — the kanban and the content chain
- [Tool Backends](/guide/tool-backends) — ScrapeGraphAI and the Python tools sidecar
- [MCP Server](/guide/mcp) — drive MagicSync from external AI assistants

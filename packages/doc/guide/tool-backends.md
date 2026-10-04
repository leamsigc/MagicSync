# Tool Backends

MagicSync's agent can use two **optional, user-configured** external backends. Both are managed from **Account → AI settings → Tool backends** and are entirely optional — the platform works without them.

- **ScrapeGraphAI** — the default scraper for `scrape_url` and the `scrapegraph_*` tools.
- **Python tools service** — a small FastAPI sidecar you run yourself for Python-only tools.

Configured values are stored per user, and secrets are encrypted at rest (AES-256-GCM). Routes only ever return presence booleans — keys and tokens never leave the server.

---

## ScrapeGraphAI (default scraper)

[ScrapeGraphAI](https://scrapegraphai.com) powers clean markdown extraction, structured JSON extraction, web search, and JS-rendered pages through the official Node SDK (`scrapegraph-js`).

### Setup

1. Create an API key at [scrapegraphai.com](https://scrapegraphai.com).
2. Open **Account → AI settings → Tool backends**.
3. Paste the key under **ScrapeGraphAI API key** and click **Test ScrapeGraphAI** (it checks your credit balance).
4. Click **Save tool backends**.

Deployments can set `SGAI_API_KEY` as a fallback for users who haven't saved a key.

### Behavior

- `scrape_url` uses ScrapeGraphAI first (reader-mode markdown).
- If ScrapeGraphAI fails, or no key is configured, the tool falls back to a raw fetch and includes an explicit `warning` in the result — nothing fails silently.
- Dedicated tools: `scrapegraph_scrape`, `scrapegraph_extract`, `scrapegraph_search`, `scrapegraph_credits`.

---

## Python Tools Service

Some libraries only exist in Python (ScrapeGraphAI's Python package, data tooling, etc.). The optional sidecar exposes them over a tiny HTTP API that the agent calls through the `python_tools_list` and `python_tool_run` tools.

The service ships in this repository at [`packages/python-tools`](https://github.com/leamsigc/magicsync/tree/main/packages/python-tools).

### Run it

```bash
# from the repo root (requires Python 3.11+)
pnpm python-tools:dev
# → http://localhost:8100
```

Or manually:

```bash
cd packages/python-tools
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# optional: Python ScrapeGraphAI tools + their LLM stack
pip install -r requirements-scrapegraph.txt
PYTHON_TOOLS_TOKEN=change-me uvicorn app.main:app --host 0.0.0.0 --port 8100
```

Docker:

```bash
docker build -t magicsync-python-tools packages/python-tools
docker run -p 8100:8100 -e PYTHON_TOOLS_TOKEN=change-me magicsync-python-tools
```

### Connect it

1. Open **Account → AI settings → Tool backends**.
2. Set **Python backend URL** to `http://localhost:8100` (or your deployed URL).
3. Optionally set the same token you started the service with.
4. Click **Test Python backend** — it probes `/health`.
5. Save.

Deployments can set `PYTHON_TOOLS_URL` / `PYTHON_TOOLS_TOKEN` as fallbacks; user settings always win.

### Built-in tools

| Tool | Description |
|---|---|
| `fetch_text` | Fetch a public URL and return raw text |
| `scrapegraph_smartscraper` | ScrapeGraphAI `SmartScraperGraph` (prompt + url) |
| `scrapegraph_searchscraper` | ScrapeGraphAI `SearchGraph` (web research query) |

ScrapeGraphAI tools return HTTP 501 until the optional library is installed.

### HTTP contract

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe (used by the Test button) |
| `GET` | `/tools` | Tool catalog (`name`, `description`, `args`) |
| `POST` | `/tools/{name}/run` | Run a tool with `{ "args": { ... } }` |

Every request carries `Authorization: Bearer <token>` when a token is configured. When no backend URL is configured, the `python_*` tools return a typed `PYTHON_BACKEND_NOT_CONFIGURED` error instead of failing mysteriously.

### Add your own tool

Edit `packages/python-tools/app/tools.py`:

```python
async def my_tool(args: dict) -> dict:
    value = str(args.get("value", "")).strip()
    if not value:
        raise ValueError("value is required")
    return {"echo": value.upper()}

TOOLS.append({
    "name": "my_tool",
    "description": "Uppercases a value.",
    "args": {"value": "string"},
})
TOOL_HANDLERS["my_tool"] = my_tool
```

Restart the service; the tool appears in `python_tools_list` and can be run by the agent (or any HTTP client) immediately.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `SGAI_API_KEY` | Deployment fallback ScrapeGraphAI key |
| `PYTHON_TOOLS_URL` | Deployment fallback sidecar URL |
| `PYTHON_TOOLS_TOKEN` | Deployment fallback sidecar token |
| `SCRAPEGRAPH_MODEL` | Model id for the Python ScrapeGraphAI tools (e.g. `openai/gpt-4o-mini`) |
| `SCRAPEGRAPH_BASE_URL` | Optional OpenAI-compatible base URL (Ollama, vLLM) |
| `OPENAI_API_KEY` | Key for the default Python ScrapeGraphAI model |
| `NUXT_PUBLISH_SECRET` | Encrypts saved backend secrets (required for saving) |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `SCRAPEGRAPH_NOT_CONFIGURED` | Add a key in Tool backends (or set `SGAI_API_KEY`) |
| Scrape results have a `warning` | ScrapeGraphAI failed; the raw-fetch fallback was used |
| `PYTHON_BACKEND_NOT_CONFIGURED` | Set the backend URL in Tool backends |
| `PYTHON_BACKEND_UNREACHABLE` | Start the sidecar and check the URL/port |
| `PYTHON_BACKEND_FAILED: 501` | Install `requirements-scrapegraph.txt` in the sidecar |
| Saving fails | Set `NUXT_PUBLISH_SECRET`; secrets cannot be stored without it |

---

## Next Steps

- [Agent Platform](/guide/agent-platform) — tools, models, RAG, PII
- [Content Board](/guide/content-board) — where scraper results become cards

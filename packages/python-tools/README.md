# MagicSync Python Tools

Optional sidecar service for Python-only tools. The Nuxt agent calls it through
the `python_tools_list` / `python_tool_run` tools using the URL + token you
configure in **MagicSync → Account → AI settings → Tool backends**.

Nothing in the main app depends on this service; without a configured URL the
`python_*` tools return a typed `PYTHON_BACKEND_NOT_CONFIGURED` error.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe (used by the "Test" button) |
| GET | `/tools` | Tool catalog (`name`, `description`, `args`) |
| POST | `/tools/{name}/run` | Run a tool with `{ "args": { ... } }` |

## Tools

- `fetch_text` — fetch a URL and return raw text.
- `scrapegraph_smartscraper` — ScrapeGraphAI `SmartScraperGraph` (prompt + url).
- `scrapegraph_searchscraper` — ScrapeGraphAI `SearchGraph` (query).

ScrapeGraphAI tools return HTTP 501 until the optional library is installed.

## Run

```bash
cd packages/python-tools
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# optional ScrapeGraphAI library + its LLM stack:
pip install -r requirements-scrapegraph.txt
PYTHON_TOOLS_TOKEN=change-me uvicorn app.main:app --host 0.0.0.0 --port 8100
```

Then in MagicSync: **AI settings → Tool backends → Python backend URL**
`http://localhost:8100`, token `change-me`, click **Test**.

## Environment

| Variable | Purpose |
|---|---|
| `PYTHON_TOOLS_TOKEN` | Optional bearer token; when set every request must match |
| `SCRAPEGRAPH_MODEL` | LiteLLM model id for ScrapeGraphAI, e.g. `openai/gpt-4o-mini` |
| `SCRAPEGRAPH_BASE_URL` | Optional custom OpenAI-compatible base URL (Ollama, vLLM) |
| `OPENAI_API_KEY` | Key for the default ScrapeGraphAI model |

The Nuxt side can also read `PYTHON_TOOLS_URL` / `PYTHON_TOOLS_TOKEN` as
deployment-wide defaults when a user has not saved their own settings.

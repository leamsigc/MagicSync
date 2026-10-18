# Chat operator

`/app/chat` is the conversational operator surface for one business. A user types a
request; the agent replies and, when the request needs work, runs one or more tools
whose results render as run cards (research, ideas, carousel, draft, board,
delivery). A draft card can be handed to the full post composer inline, and a
carousel can be revised in place. The tool and skill inventory the operator may
choose from comes from `GET /api/v1/agent/capabilities`.

## Sub-features

- `chat-open` loads the operator surface for the active business with the message composer.
- `chat-tools` opens the options panel that lists the selectable tools and skills.
- `chat-message` types a request into the composer.
- `chat-reply` sends the request and renders the assistant reply.
- `chat-draft-composer` hands a write-post draft to the full composer inline, with the connected platforms on the left.

## How to get to it (user POV)

- Choose **Chat** / **AI assistant** in the dashboard or the sidebar; the link carries the active business.
- Open `/app/chat` directly. The route needs a logged-in user and an active business.

## Driving it with Playwright

Preconditions:

- Doctor passes; a Nuxt dev server answers `200` on `http://localhost:3000`.
- A throwaway user is logged in **and owns a business** (`createTestUser` + `loginWith` + `createActiveBusiness`).
- Content capabilities (`content.scan`, `content.write`) need a **published Brand Playbook**; publish one in `setup` (`publishBrandPlaybook`).
- `chat-run` and `chat-draft-composer` call the agent runtime and need provider keys (OpenAI / Google / LangSearch). Treat them as best effort and give them long waits.

- **Open the chat.** Navigate to `/app/chat`, `waitForHydration`, then assert the composer input `page.getByTestId('chat-input')` is visible.
- **Read the options panel.** Choose the cog (`data-testid="chat-options-toggle"`). The panel lists the tools and skills the operator may select.
- **Type a request.** `await page.getByTestId('chat-input').fill('List my content board cards.')`.
- **Send and read the reply.** Choose `data-testid="chat-send"`. The assistant message streams in; assert `.chat-markdown` becomes visible. When the model calls a tool, a `data-testid="run-card"` appears with one `run-step` per call (tool-calling is model-dependent).
- **Hand a draft to the composer.** Send a write request, wait for a `data-testid="run-section" data-kind="draft"`, then choose `data-testid="draft-open-editor"`. The full composer appears inline as `data-testid="chat-post-composer"` with `data-testid="post-platform-selector"` visible. This step depends on the write chain and a tool-calling model.

## Gotchas

- The AI steps need provider keys and are slow on a cold route — set a large timeout and do not treat a slow step as a failure.
- The composer only opens from a rendered draft card; without a successful `write_post` there is no `draft-open-editor`.
- `/app/chat` is business-scoped; with no active business the composer is disabled (`needsBusiness`).
- Carousel revision is a single-tool harness: a typed edit resolves the latest carousel artifact server-side, so `revise_carousel` is available without the page picker.

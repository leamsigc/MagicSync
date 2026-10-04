---
name: chat-history-replay
description: Persist and replay complete streamed agent conversations, including user turns, assistant output, reasoning, tool calls, and lifecycle events.
triggers:
  - "chat history"
  - "tool history"
  - "replay agent run"
  - "persist tool calls"
---

# Complete chat history replay

Persist the human-visible turn in `chat_messages`, and persist the full normalized
agent event stream in the assistant message metadata under `events`. Keep the
structured `toolCalls`, `toolEvents`, `reasoning`, run status, and cancellation
fields as derived render-friendly projections for older clients and fast loading.

The agent session store remains the canonical provider/session transcript. The
chat assistant record is the canonical thread-facing replay envelope:

```ts
metadata: {
  sessionId,
  runId,
  status,
  reasoning,
  events,      // ordered message/tool/run/error lifecycle events
  toolCalls,   // grouped tool arguments and results
  toolEvents,  // compatibility projection for activity logs
  cancelled,
  error,
}
```

When consuming history, prefer `events` and fall back to `toolEvents` for older
rows. Reconstruct the UI from persisted data rather than inventing local phases;
unknown event types should be ignored so the protocol can grow safely.

Every event must be appended in emission order, including run start/completion,
text and thinking deltas, tool progress, approval requests, errors, and cancel.
The user message is saved before the model run and the assistant envelope is
saved after the run settles, including failed and cancelled runs.

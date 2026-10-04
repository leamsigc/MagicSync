---
name: harness-intent-routing
description: Route high-confidence chat intents through a server-owned tool allowlist and bounded workflow instead of exposing the full agent catalog.
triggers:
  - "tool loop"
  - "wrong tool"
  - "intent routing"
  - "single tool workflow"
---

# Harness intent routing

When a request has a high-confidence artifact intent, classify it at the
trusted chat boundary before building the agent run. Override user-selected
allowed tools for that intent, inject a short harness instruction, and bound
the workflow so the model cannot drift into board, delivery, or duplicate tool
calls.

For carousel generation:

- allow only `generate_carousel`;
- pass the original request through the tool's `request` parameter;
- let the carousel workflow own research and generation internally;
- never create or mutate a content-board card during preview generation;
- cap the run to one visible tool invocation and abort duplicate starts;
- return the review artifact to the chat renderer; materialization remains a
  separate human approval action.

Keep the classifier conservative. Normal business goals and explicit card
operations should continue through the general tool catalog. The UI may expose
manual tool toggles, but the server harness remains authoritative and may
narrow permissions for safety and determinism.

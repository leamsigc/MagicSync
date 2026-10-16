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

For carousel **revision**:

- classify it from a **structural field** (`carouselRevision` in the request
  body), never from the word "revise" in free text — one classifier for both
  intents is what forced `generate_carousel` onto revision requests;
- allow only `revise_carousel`;
- carry `artifactId` + `slideIds` through tool context
  (`AgentToolContext.carouselTarget`), never as prose in the message, or the
  edit sentence becomes the research topic;
- because `MAX_TOOLS_PER_TURN` is 7 and the chat mount is already full, reach the
  revision tool through its own narrow harness allowlist — do not widen
  `CHAT_AGENT_MOUNT`;
- the tool prefers the structural target and only falls back to model-supplied
  ids when the harness gave none;
- never fall back to a whole-object rewrite when a target was named but did not
  resolve — error and ask instead.

Keep the classifier conservative. Normal business goals and explicit card
operations should continue through the general tool catalog. The UI may expose
manual tool toggles, but the server harness remains authoritative and may
narrow permissions for safety and determinism.

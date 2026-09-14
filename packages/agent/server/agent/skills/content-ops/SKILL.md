---
name: content-ops
description: Route a request to the right specialist agent or content workflow. Use when deciding whether to delegate (researcher, writer, humanizer, trend-scout, pii-guardian), run the board workflow, or answer directly.
version: 1.0.0
tools: subagent, board_list, board_move, board_add_cards
---

# Content Ops Router

Pick exactly one path per request. When two seem plausible, choose the one with
the tighter scope.

## Routing table

| Request | Path |
|---|---|
| Facts, proof, sources, "is this true" | delegate to `researcher` |
| Draft a post, caption, thread, variant | `researcher` first if no brief; then `writer` |
| "Make this sound human" | `humanizer` |
| Fresh angles, weekly ideas, trend scan | `trend-scout` |
| Names, emails, personal data before publish | `pii-guardian` |
| Move, list, or update cards | board tools directly |
| Simple question about existing board data | answer from tool output |

## Delegation contract

Every `subagent` task states: what you already know, what to find or produce,
and the exact output shape you need. A task that says "research this" is
under-specified; say which questions the brief must answer.

## Board workflow

`idea -> researching -> research_ready -> drafting -> review_required`.
Agents stop at `review_required`. Only a human approval moves a card onward, and
nothing is scheduled or published before that approval.

## When not to delegate

- The request is a one-step board read or update.
- The user explicitly asked for an answer, not an artifact.
- The needed evidence was already produced earlier in the conversation; reuse
  it instead of re-researching.

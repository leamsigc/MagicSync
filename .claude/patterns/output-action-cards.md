# Output action cards

Use one operator-owned result card per user request. Keep intermediate tool calls in the activity rail and render the final output as the primary surface. The card owns actions for its output type (for example, approve/schedule, keep as draft, request changes, open in editor, and delete for a carousel).

## Implementation rules

- Route high-intent requests in the server harness before the model sees the full catalog.
- Pass the original request through server-owned context so a model cannot drift to a source-card workflow.
- Filter intermediate sections when a canonical output section exists; a carousel card should not also show research, board, or delivery cards.
- Render visual outputs as a responsive gallery, with the complete artifact visible before action controls.
- Every mutating action has loading feedback and a toast for success/failure.
- Keep actions localized in the package page locale JSON and use named handlers in Vue templates.
- Preserve complete machine/tool events in history, but show them collapsed or in the activity rail by default.

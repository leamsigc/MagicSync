---
name: write-prd
description: Write implementation-ready project PRDs from repository research, with dependency tracking and verification gates.
triggers:
  - "PRD"
  - "product requirements"
  - "implementation plan"
  - "feature specification"
edges:
  - target: "../context/architecture.md"
    condition: "when documenting system boundaries and data flow"
  - target: "../context/conventions.md"
    condition: "when defining implementation and verification requirements"
  - target: "../../.aiContext/PRD.md"
    condition: "when handing work to another model or executing/sequencing the task list"
last_updated: 2026-09-13
---

# Write Implementation PRDs

## Context

Load `ROUTER.md`, architecture, stack, decisions, conventions, patterns, current
progress, the relevant source files, existing PRDs, and the user's explicit
decisions. Treat existing uncommitted code as evidence to audit, not as code to
revert or silently bless.

## Steps

1. Record the current implementation and identify partial or broken seams.
2. Research external references using primary repository/documentation sources.
3. Separate reusable contracts from stack-specific implementation details.
4. Ask for unresolved product decisions before freezing the design.
5. Write one master PRD with goals, non-goals, architecture, domain objects,
   state machines, dependencies, waves, acceptance criteria, and engineering
   gates.
6. Split major capabilities into feature PRDs. Each feature PRD must contain
   current files, exact contracts, data model, UX, authorization, failure
   behavior, tests, and acceptance criteria.
7. Create a tracker with stable task IDs, dependency order, checkboxes, evidence
   rules, and a session handoff template.
8. Link every feature PRD from the master PRD and tracker.

## Gotchas

- A PRD must describe what existing code actually does, not what file names
  imply it does.
- Do not copy direct database/query patterns from reference projects when this
  repository requires service-layer access.
- Do not call a queued run completed until its output is materialized.
- Do not treat a model output as an approval or publishing authorization.
- Distinguish a draft from the current published business context.
- Keep the control plane authoritative when introducing an external agent
  runtime.
- Record contradictions between user requirements and technology constraints.
- Do not mark tracker items complete from file existence alone.

## Verify

- [ ] Master PRD exists and links every feature PRD.
- [ ] Feature PRDs have no unexplained scope gaps or duplicate ownership.
- [ ] Dependencies form a valid implementation order.
- [ ] User decisions are recorded explicitly.
- [ ] Every PRD includes acceptance criteria and failure/security behavior.
- [ ] Tracker includes evidence requirements and session handoff instructions.
- [ ] File links resolve and headings are readable.
- [ ] No secrets or private data were included.

## Debug

If a smaller model cannot implement a PRD, inspect whether the document is
missing one of: source file references, request/response examples, state
transitions, ownership rules, failure semantics, test cases, or explicit
non-goals. Update the smallest affected PRD and tracker row rather than adding
unrelated prose to the master document.

## Update Scaffold

- [x] Add this pattern to `.claude/patterns/`.
- [x] Add this pattern to `.claude/patterns/INDEX.md`.
- [ ] Update context files if the implemented architecture changes.

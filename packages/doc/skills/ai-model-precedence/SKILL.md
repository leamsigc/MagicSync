---
name: ai-model-precedence
description: Resolve which AI provider/model a call uses — business override, then the user's account default, then the system model — and keep every AI path on that precedence. Use when "my chosen model isn't used", a custom provider (Ollama/custom base URL) is ignored, chat or business creation runs on the system model, or when adding a new AI call site.
---

# AI model precedence

## When to use
A user's configured model is ignored, a custom provider/Ollama base URL never
applies, or you are adding a new place that calls a model.

## The one precedence
**business (workspace) override → user account default → system default.**
`userLlmConfigService.getEffectiveConfig(userId, businessId)` implements it and
is the only thing a call site should use.

## Steps
1. **Never read `getDefaultConfig` for a business-scoped call.** Use
   `getEffectiveConfig(userId, businessId)`. Reading the user default alone is
   what made `schedulerUnifiedAI` ignore the business selection.
2. **A `system` provider means "inherit"**, not "jump to the system model":
   `getEffectiveConfig` falls through to `loadUserDefault` for it. Do not map the
   sentinel straight to `systemDefaultConfig`.
3. **Agent-layer paths** use `buildAgentRunConfig(userId, businessId)` →
   `getEffectiveConfig`. Keep them there.
4. **Scheduler SDK paths** use `schedulerUnifiedAI`, which resolves via
   `resolveConfig(userId, businessId)`; pass `businessId` through the options
   (`SchedulerBrandGrounding.businessId` already exists).
5. **UI labels are mode-aware.** In the workspace editor the inherit option reads
   "My account AI (default)"; the account page keeps "Workspace AI". Same value,
   different meaning per surface.
6. **Report the source.** `GET /api/v1/llm/effective` returns
   `source: override | user-default | system-default`; a `system` override must
   not report `override`.

## Gotchas
- pi cannot resolve `provider: 'system'`; any stored row carrying it must be
  translated (guarded in `loadUserDefault` and `resolveStoredConfig`).
- A custom model on a dynamic provider (`ollama`/`llama`) must be registered with
  its base URL (`registerRuntimeModel` / `applyRunBaseUrl`) or it never resolves.
- Business creation runs before the business exists, so it uses the account
  default — do not expect a workspace override there.

## Verify
1. Override = real provider → chat and scheduler routes use it.
2. Override = inherit + account AI set → account model is used.
3. Override = inherit + no account AI → system model.
4. The chat header badge shows the resolved `provider/model`.

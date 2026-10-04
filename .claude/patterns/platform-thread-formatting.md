# Platform Thread Auto-Formatting (Long Post → Per-Platform Threads)

How long master posts are split into platform-sized threads in the post composer. Use when touching composer content handling, platform overrides, or comment limits.

## Core Model

A thread = per-platform override where `content` is the first chunk and `comments` are the remaining chunks. Publishing plugins (`x.plugin.ts`, `bluesky.plugin.ts`, `instagram.plugin.ts`, ...) already post `platformContent[platform].comments` as replies.

## Key Files

| File | Role |
|------|------|
| `packages/scheduler/shared/threadSplitter.ts` | Pure splitter: `splitTextIntoChunks(content, maxLength)` + `buildPlatformSplit(content, maxLength)` → `{ fits, content, comments }`. Paragraphs → sentences → words → hard slice. No AI needed. |
| `packages/scheduler/app/components/scheduler/posts/components/assistant/PlatformAutoFormat.vue` | Composer panel: shows per-platform fit status vs `maxPostLength`, applies overrides via single `apply` emit. Platforms without `supportsComments` get truncated instead of threaded. |
| `packages/scheduler/shared/platformConstants.ts` | `maxCommentLength?: number` on `PlatformConfig`; falls back to `maxPostLength` when unset. |

## Wiring Rules

- Overrides must be written through `platformSettingsState.platformContent.value[platform]` in `PostModalContent.vue` — the existing deep watcher syncs it into `postForm.platformContent`, which flows to save/publish.
- Master content is never mutated by auto-format; only overrides change.

## Comment Validation (3 layers)

1. **Editor UI** — comment `UTextarea` gets `:maxlength="currentMaxCommentLength"` (`maxCommentLength ?? maxPostLength`) + live `n/max` counter with red over-limit state.
2. **Live validation** — `useValidation.ts` `validatePlatform()` errors when any comment exceeds the limit.
3. **Save validation** — `usePlatformConfiguration.ts` `validatePostForPlatform()` blocks save with i18n key `validation.commentTooLong`.

## Gotchas

- Dedupe platform types before analysis — multiple accounts can target the same platform (`[...new Set(platforms)]`).
- `x` and `twitter` are separate config keys with identical limits.
- Inline multi-statement Vue handlers need arrow syntax: `@click="() => { flag = !flag }"`.

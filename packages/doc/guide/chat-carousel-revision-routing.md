# Carousel revision routing in chat

## The bug

Asking the chat to change one slide of a carousel produced a **brand-new**
carousel on a nonsense topic, or rewrote the whole deck.

Two defects stacked:

1. **The revision tool was never mounted.** `isCarouselIntent` matched the word
   "revise" too, so the harness forced `allowedTools = ['generate_carousel']`
   and single-tool mode. `revise_carousel` — the tool the request named — is not
   in `CHAT_AGENT_MOUNT`, so the model physically could not call it. It fell back
   to `generate_carousel`, which substituted the *edit message itself* as the
   research **topic** (`ctx.carouselRequest`), producing an unrelated deck under a
   new artifact id. The original was never touched.
2. **Ids travelled as prose.** The UI composed the ids into the message text
   (`carousel.revisionMessage`), which the backend regex-parsed — fragile, and it
   was exactly what poisoned the research topic.

A third, latent defect: `revise_carousel` had no way to know which slide was
clicked, and `carousel-generation.service.ts` silently fell back to a whole-deck
rewrite when it could not resolve a target slide from the instructions.

## The fix

**Structural routing, not prose.** The client now sends a `carouselRevision`
object, not ids baked into the message:

```ts
// packages/ai-tools/.../useAgentChat.ts
carouselRevision: { artifactId: string, slideIds: string[] }
```

`POST /api/v1/agent/chat` validates it (`ChatRequestSchema.carouselRevision`) and
`resolveCarousel(body, requestedTools)` routes it:

- `carouselRevision` present → allow only `revise_carousel`, inject a revision
  harness prompt, pass the ids through `toolContext.carouselTarget`.
- creation verbs + "carousel" (and no revision) → allow only `generate_carousel`.
- otherwise → the normal allowed-tools path.

`isCarouselIntent` no longer matches "revise"/"update", so an edit verb can never
be mistaken for a generation.

**The tool prefers the structural target.** `revise_carousel` reads
`ctx.carouselTarget.slideIds` when the model passed none, so the clicked page is
always the target.

**No silent whole-deck rewrites.** `prepareRevision` now rejects an ambiguous
request that names a slide ("slide 2", "the second page") but resolves none,
instead of shipping the whole deck back to the model.

**Platform is preserved.** The create workflow stores `platform` on the artifact
output; `revise` returns the stored platform instead of hardcoding `instagram`.

The UI also gained a page picker next to "Request changes", so a specific slide
can be targeted explicitly (empty = whole deck).

## Gotchas

- `MAX_TOOLS_PER_TURN` is 7 and `CHAT_AGENT_MOUNT` already sits at 5 + 2
  framework tools. `revise_carousel` is deliberately **not** added to the mount —
  it is reached only through the revision harness, which mounts a single tool.
- The harness prompt still lists `Original user request` / `Requested changes`
  for the model to read; ids must never be encoded there again.
- Whole-deck regeneration is still valid when the user explicitly asks for it
  (no slide is named), so the merge path is chosen by whether a target resolved.

## Verify

1. Generate a carousel, pick page 2, ask for a change → only page 2 changes; every
   other slide is byte-identical; the same artifact id/version advances.
2. Ask "make it punchier" with whole deck selected → full regenerate is allowed.
3. Ask "change the slide about pricing" (no ordinal) → clear error asking which
   slide, never a silent rewrite.
4. `pnpm --filter @local-monorepo/agent test` passes.

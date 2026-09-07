---
name: ai-extraction-streaming
description: Long-running AI extraction endpoints with NDJSON progress streaming and backend-driven loaders
triggers:
  - "ai extraction"
  - "progress loader"
  - "streaming endpoint"
  - "extraction takes too long"
edges:
  - target: patterns/add-endpoint.md
    condition: when creating the underlying endpoint
  - target: context/stack.md
    condition: when checking AI SDK usage
last_updated: 2026-08-23
---

# AI Extraction with Progress Streaming

## Context

Long AI calls (scrape + generateObject) look broken with a plain spinner. The
business onboarding flow (`/app/business`) streams real progress events so the
UI shows the actual active step.

Reference implementation: `packages/scheduler/server/api/v1/ai/information/index.post.ts`

## Backend Pattern

1. **Split independent work into parallel `generateObject` calls** — one focused
   schema per call beats one giant schema (faster, fewer repair retries, and a
   failure in one doesn't kill the other).

2. **Return an NDJSON `ReadableStream`**, not a JSON body:
   ```ts
   const stream = new ReadableStream<Uint8Array>({
     async start(controller) {
       const send = (payload: ExtractionEvent) =>
         controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));
       // ... emit {type:'step', step, status} as work progresses,
       // finish with {type:'complete', data} or {type:'error', message}
     },
   });
   event.node.res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
   event.node.res.setHeader('Cache-Control', 'no-cache, no-transform');
   event.node.res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
   return stream;
   ```

3. **Extract deterministic facts in code, not via AI.** Anything scrapeable
   (og:image, favicon, theme-color, font URLs) is extracted from HTML directly
   (`businessInfoHelpers.ts`) and merged OVER the model output — cheaper,
   faster, more accurate.

4. **Temperature**: extraction tasks use low temperature (~0.2). A temperature of
   2 caused slow, rambling, erratic output.

5. **Trim prompt noise**: filter cssVariables/metaTags to brand-relevant keys and
   cap text content before serializing into prompts.

## Frontend Pattern

1. **Read the stream** with `$fetch.raw(..., { responseType: 'stream' })` +
   `body.getReader()`, splitting on `\n` (see `useBusinessManager.extractBusinessInfoWithProgress`).
2. **Drive the loader from events**: map each `{step, status}` to a loader index
   and pass it as `activeStep` prop to `MultiStepLoader.vue` (external mode —
   internal timers disabled when `activeStep` is set).
3. Passing `activeStep = steps.length` marks all steps complete; show the result
   after a short delay (~600ms) so completion is visible.

## Gotchas

- EventSource can't POST — use fetch + ReadableStream reader for NDJSON.
- Guard `controller.enqueue` against aborts (client closed the modal).
- Keep exported zod schemas + types in the route file; frontend imports types
  from there (`#layers/BaseScheduler/...`).

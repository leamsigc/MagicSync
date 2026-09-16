# Pattern Index

Lookup table for all pattern files in this directory. Check here before starting any task — if a pattern exists, follow it.

| Pattern | Use when |
|---------|----------|
| [agentic-goal-layer.md](agentic-goal-layer.md) | Adding goal skills, extending the orchestrator, approval gates, goal-run persistence |
| [add-endpoint.md](add-endpoint.md) | Adding a new API endpoint to a layer package |
| [add-service.md](add-service.md) | Adding a new service class in the db package |
| [add-page.md](add-page.md) | Adding a new page in a layer package |
| [business-onboarding-ux.md](business-onboarding-ux.md) | Placing features in the business-owner navigation, setup checklists, dashboard quick actions |
| [debug-api.md](debug-api.md) | Debugging API endpoint failures |
| [social-media.md](social-media.md) | Working with social media platform integrations |
| [add-mcp-tool.md](add-mcp-tool.md) | Exposing a service operation as an MCP tool |
| [db-migration-squash.md](db-migration-squash.md) | Squashing unpushed Drizzle migrations into one clean migration |
| [media-gallery.md](media-gallery.md) | Paginated asset gallery with infinite scroll + large-file (multipart) uploads |
| [scaled-stage-preview.md](scaled-stage-preview.md) | Fixed target-resolution rendering + scaled-down in-app previews (TVs, OG images) with inline-style HTML output |
| [admin-data-views.md](admin-data-views.md) | Admin CRUD views (users, businesses, integrations, audit log) — borderless cards, Nuxt UI tables, service-backed endpoints |
| [docker-build.md](docker-build.md) | Docker/CI image build failures — pnpm @pnpm/exe verification, musl native deps, pnpm version pinning |
| [security-audit.md](security-audit.md) | Full-stack security audit — SQLi, path traversal, SSRF, IDOR, secrets, infra; produces SECURITY_REPORT.html |
| [public-tool-dual-storage.md](public-tool-dual-storage.md) | Public tools where guests save locally (IndexedDB) and users save to db, plus public share-slug viewer pages |
| [shared-tool-registry.md](shared-tool-registry.md) | Adding/registering tools in the unified registry (`packages/ui/app/utils/toolRegistry.ts`) and rendering them in `/tools` + `/app/toolbox` |
| [tool-workflow-bridge.md](tool-workflow-bridge.md) | Saving tool output as an asset (BaseSaveAssetModal) and handing it to the post composer via sessionStorage keys |
| [platform-thread-formatting.md](platform-thread-formatting.md) | Splitting long posts into per-platform threads (threadSplitter, platform overrides, comment length validation) |
| [ai-extraction-streaming.md](ai-extraction-streaming.md) | Long-running AI extraction endpoints — NDJSON progress streaming, parallel generateObject calls, backend-driven loaders |
| [theme-tokens.md](theme-tokens.md) | Fixing UI that breaks in light/dark mode — hardcoded colors → Nuxt UI semantic tokens |
| [color-mode-assets.md](color-mode-assets.md) | Hydration attribute mismatch from color-mode-driven `src`/attributes — render both light/dark variants and let CSS choose |
| [dev-hints-triage.md](dev-hints-triage.md) | `@nuxt/hints` console noise (`hints:hydration`, `htmlValidate`, `lazyLoad`) — real hydration/markup bugs vs. dev-only diagnostics |
| [tool-control-bar.md](tool-control-bar.md) | Camera-style bottom control bar for tools (`/tools/*`) — segmented mode, scrubbable dials, icon cluster popovers, yellow primary pill |
| [figma-editor-refresh.md](figma-editor-refresh.md) | Figma-style refresh of a `/tools/*` canvas editor — top bar, icon rail, stage, properties panel with tokens, i18n, AI worker UX |
| [carousel-deck-templates.md](carousel-deck-templates.md) | Carousel deck templates (palette/font/pattern per deck), multi-image slide layouts, and the all-pages template gallery |
| [browser-video-export-audio-mux.md](browser-video-export-audio-mux.md) | In-browser MP4 export that mixes background audio + source audio (mediabunny two-pass re-mux) and burns time-based subtitle cues |
| [fullcalendar-nuxt.md](fullcalendar-nuxt.md) | Embedding FullCalendar 6 in Nuxt 4 without customRenderingMap crashes |
| [seo-og.md](seo-og.md) | Fixing Open Graph / link previews on Nuxt Content + nuxt-og-image pages |
| [entitydetails-kv.md](entitydetails-kv.md) | Storing a feature in `entity_details` KV rows with zero migrations |
| [safe-build.md](safe-build.md) | Building the site without freezing the machine — heap caps, concurrency limits |
| [auth-session-lifecycle.md](auth-session-lifecycle.md) | better-auth session lifecycle — $sessionSignal listeners, fetchSession, logout without get-session floods |
| [ssr-safe-state.md](ssr-safe-state.md) | SSR-safe state — no module-scope ref/reactive for request-varying data, useState only |
| [client-only-node-builtins.md](client-only-node-builtins.md) | Client-bundle 500s from Node builtins (`events`, `buffer`, `path`) imported in `app/` code |
| [playwright-golden-oracles.md](playwright-golden-oracles.md) | Deterministic screenshot goldens — dev-overlay suppression, motion settle, dark-mode forcing |
| [modal-picker.md](modal-picker.md) | UModal select-list + options + confirm POST with loading/toast/i18n feedback |
| [write-prd.md](write-prd.md) | Writing implementation-ready master and feature PRDs with dependency tracking |
| [credential-envelope.md](credential-envelope.md) | Removing plaintext/base64 credential assumptions — AES-256-GCM envelopes, fail-closed reads, Node/Python parity |
| [pi-agent-layer.md](pi-agent-layer.md) | Scaffolding a Nuxt layer package (`packages/agent`) and integrating the pi SDK in-process with a hermetic SSE stub test seam |
| [tool-backend-settings.md](tool-backend-settings.md) | User-configurable external tool backends (ScrapeGraphAI, Python tools service) with encrypted secrets, test routes, and agent proxy tools |
| [web-grounded-research.md](web-grounded-research.md) | Grounding a board action in live web evidence — LLM brief, SSRF-safe scrape, synthesis, persist to brief |
| [board-stage-agents.md](board-stage-agents.md) | Wiring content-board column drops to agent runs (research on drop, generate on drop) |
| [port-not-ported.md](port-not-ported.md) | Replacing a NOT_PORTED 501 stub with a native Nuxt implementation |
| [nuxt-ui-chat.md](nuxt-ui-chat.md) | Migrating a bespoke chat UI onto the Nuxt UI chat kit while keeping a custom streaming backend |
| [evlog-observability.md](evlog-observability.md) | Wiring evlog request logging, AI SDK telemetry, Better Auth identity, and dual-write audits |
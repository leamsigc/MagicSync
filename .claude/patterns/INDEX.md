# Pattern Index

Lookup table for all pattern files in this directory. Check here before starting any task — if a pattern exists, follow it.

| Pattern | Use when |
|---------|----------|
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
| [tool-control-bar.md](tool-control-bar.md) | Camera-style bottom control bar for tools (`/tools/*`) — segmented mode, scrubbable dials, icon cluster popovers, yellow primary pill |
| [carousel-deck-templates.md](carousel-deck-templates.md) | Carousel deck templates (palette/font/pattern per deck), multi-image slide layouts, and the all-pages template gallery |
| [browser-video-export-audio-mux.md](browser-video-export-audio-mux.md) | In-browser MP4 export that mixes background audio + source audio (mediabunny two-pass re-mux) and burns time-based subtitle cues |
| [fullcalendar-nuxt.md](fullcalendar-nuxt.md) | Embedding FullCalendar 6 in Nuxt 4 without customRenderingMap crashes |
| [seo-og.md](seo-og.md) | Fixing Open Graph / link previews on Nuxt Content + nuxt-og-image pages |
| [entitydetails-kv.md](entitydetails-kv.md) | Storing a feature in `entity_details` KV rows with zero migrations |
| [safe-build.md](safe-build.md) | Building the site without freezing the machine — heap caps, concurrency limits |
| [auth-session-lifecycle.md](auth-session-lifecycle.md) | better-auth session lifecycle — $sessionSignal listeners, fetchSession, logout without get-session floods |

---
name: media-gallery
description: Paginated asset gallery with infinite scroll and large-file (multipart) uploads in the assets layer
triggers:
  - "infinite scroll"
  - "load more assets"
  - "upload video"
  - "large file upload"
  - "media gallery"
edges:
  - target: context/architecture.md
    condition: when understanding layer structure
  - target: context/conventions.md
    condition: when checking service/component patterns
  - target: patterns/add-endpoint.md
    condition: when adding new asset API endpoints
last_updated: 2026-03-30
---

# Media Gallery (Infinite Scroll + Large Uploads)

## Context

The assets layer (`packages/assets/`) serves `/app/media`. Data flows through the
`useAssetManagement` composable (module-level `assets` singleton, per-instance
`pagination`/`selectedAssets`/`uploadQueue`). Business context comes from the
app-wide `useState<string>('business:id')`, populated by the connect global
`business-check` middleware. Uploads must support large videos — never base64/JSON.

## Steps

1. **Business wiring**: read the active business directly from the shared state
   (avoids a cross-layer import to `#layers/BaseConnect`):
   ```ts
   const activeBusinessId = useState<string | undefined>('business:id')
   const selectedBusinessId = ref<string | undefined>(activeBusinessId.value)
   watch(activeBusinessId, id => { selectedBusinessId.value = id })
   ```
   Let the gallery own data fetching via its `businessId` prop — don't duplicate
   `fetchAssets` calls on the page.

2. **Infinite scroll**: attach an `IntersectionObserver` to a sentinel element
   rendered only while more pages exist:
   ```ts
   const sentinelRef = ref<HTMLElement | null>(null)
   let sentinelObserver: IntersectionObserver | null = null
   watch(sentinelRef, (el) => {
     sentinelObserver?.disconnect()
     sentinelObserver = null
     if (el && typeof IntersectionObserver !== 'undefined') {
       sentinelObserver = new IntersectionObserver((entries) => {
         if (entries.some(e => e.isIntersecting)) loadMore()
       }, { rootMargin: '300px 0px' })
       sentinelObserver.observe(el)
     }
   })
   onBeforeUnmount(() => sentinelObserver?.disconnect())
   ```
   `loadMore()` must guard on both `isLoading` and an `isLoadingMore` flag to avoid
   overlapping requests. Always dedupe by `asset.id` when appending pages.

3. **Large uploads (multipart)**: send raw bytes via `FormData` + `XMLHttpRequest`
   (ofetch has no `onUploadProgress`, so XHR is used for real progress):
   - Client: `formData.append('files', file)` (+ optional `businessId`).
   - Server (`server/api/v1/assets/index.post.ts`): detect
     `multipart/form-data`, read with `readMultipartFormData`, write each part
     directly to `{mount}/userFiles/{userId}/{uuid}.{ext}` via `fs.writeFile`.
   - Keep the serve route path shape `assets/serve/{fullFilename}` unchanged so
     `[...path].get.ts` / `[filename].get.ts` keep serving the files.

4. **Delete cleanup**: remove the stored file best-effort after the DB delete:
   `getFileFromAsset(asset)` rebuilds the path from `asset.url`.

## Gotchas

- `#layers/BaseConnect/...` is only resolvable in the full site build — layer
  packages that don't extend connect should read `useState('business:id')` instead.
- `storeFileLocally` requires a base64 data-URL `content` — unsuitable for large
  files. Write multipart buffers directly with `fs.writeFile`.
- Server page limit default: `index.get.ts` uses `limit || 200`; the composable
  requests 20. Keep the composable `limit` (20) the source of truth for infinite scroll.
- h3/Nitro has no default multipart body limit — enforce size caps at the app level
  (MediaUploader `maxSize`, default 800 MB).

## Verify

- [ ] `/app/media` reflects the active business (`useState('business:id')`)
- [ ] Scrolling to the bottom loads the next page automatically (sentinel + observer)
- [ ] No overlapping load-more requests (`isLoadingMore` guard)
- [ ] Uploads send `multipart/form-data`; server writes raw bytes, not base64
- [ ] `pnpm assets` build passes and eslint shows no new errors
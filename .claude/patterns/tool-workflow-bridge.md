# Tool → Workflow Bridges (Save-as-Asset + sessionStorage Handoff)

How to connect a public/creative tool output into the app workflow: save it as an asset, then hand it to the post composer.

## Save as Asset

Use `packages/ui/app/components/BaseSaveAssetModal.vue` (auto-imported globally). It owns upload, loading/error states, 401 login-prompt toast, success toast, and emits `saved(asset)`.

```vue
<BaseSaveAssetModal
  v-model:open="showModal"
  accept="dataUrl"            <!-- 'blob' | 'dataUrl' | 'file' -->
  :filename="name"
  :payload="payload"
  @saved="(asset) => savedAssetId = asset.id"
/>
```

Server contract (`POST /api/v1/assets`, `packages/assets/server/api/v1/assets/index.post.ts`):
- multipart/form-data, file part name `files`, optional `businessId`
- auth via session cookie (`checkUserIsLogin` → 401 when guest)
- response `{ success: true, data: Asset[] }`

Do not modify `video-cropper/components/SaveAsAssetModal.vue` — it is a legacy name-only modal; new flows use BaseSaveAssetModal.

## Hand Off to Composer

Composer consumer: `packages/site/app/pages/app/posts/new.vue` `onMounted` reads then **removes** both keys:

| Key | Shape | Effect |
|-----|-------|--------|
| `video-cropper-media` | `{ assetId }` | asset attached as mediaAsset |
| `repurposed-content` | `{ content, fullContent, platform, isThread, comments, mediaAssets?, platformOverrides? }` | content + per-platform overrides prefilled |

```ts
sessionStorage.setItem('video-cropper-media', JSON.stringify({ assetId }))
await navigateTo('/app/posts/new')
```

Map repurpose results: `content` = platform-specific text, `fullContent` = original input, `isThread = comments.length > 0`.

## Gotchas

- Playwright `getByRole('button', { name: 'X' })` is substring-matched — adding a button whose label contains an existing label ("Save" vs "Save to Library") breaks selectors; use `exact: true`.
- Root eslint enforces single-template-root and `no-explicit-any`; wrap modals inside the existing root element and cast through typed shapes.

---
name: media-upload-progress
description: Fix media upload progress tracking and large-file errors in the asset uploader. Use when upload progress stays at 0/100 or large video uploads fail with a network/413 error.
---

# Media Upload Progress

## Steps

1. In `packages/assets/app/composables/useAssetManagement.ts`, mutate progress through the reactive `uploadQueue.value` (not the raw `uploadItems` array) so Vue reactivity updates the UI.
2. Map completion and error states through the same reactive queue entries (match by id).
3. In `xhr.onload`, detect HTTP 413 and reject with a clear "file too large" message.
4. Note: production uploads through Cloudflare are capped at ~100MB; larger files require direct-to-storage (S3/R2) or chunking.

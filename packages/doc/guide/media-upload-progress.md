# Media Upload Progress & Large File Errors

## Issue
- Upload progress stayed at 0/100 because progress mutations targeted the raw `uploadItems` array instead of the reactive `uploadQueue`.
- Large video uploads (>~100MB) failed with a Cloudflare 413 / network error.

## Fix
- Progress, completion, and error states now mutate through `uploadQueue.value` (matched by id) so the UI updates.
- `xhr.onload` maps HTTP 413 to a clear "file too large" message.

## Limitation
Production is behind Cloudflare, which caps proxied uploads at ~100MB. Files larger than that need direct-to-storage (S3/R2) or chunked upload.

## Chunked Upload
Files larger than 20MB are uploaded in 8MB chunks to `/api/v1/assets/chunk`, which assembles them server-side. This bypasses per-request size limits (e.g. Cloudflare 100MB).

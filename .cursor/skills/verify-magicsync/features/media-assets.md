# Media assets

`/app/media` is the asset gallery. A user uploads images and video through a
modal, browses what is stored as cards, filters and selects those cards, and
deletes them. Each file is capped at 800MB, and the browser only accepts image
and video types even though the drop zone advertises documents. Assets also
group into folders that belong to one business. The gallery opens on Unfiled,
the Folder filter switches between All assets, Unfiled and any folder, and a
selection moves into a folder or back to Unfiled. Deleting a folder is never
destructive, its assets fall back to Unfiled.

## Sub-features

- `media-open` loads the gallery with its type counts and an empty state.
- `media-open-uploader` opens the uploader modal from the gallery.
- `media-upload-dedicated` loads the uploader on its own route.
- `media-upload-accept` accepts image and video files and refuses every other type.
- `media-upload-progress` reports per-file progress and the uploaded filename.
- `media-upload-error` raises an error toast when validation fails or no file lands.
- `media-list` shows each stored asset as a card headed by its original filename.
- `media-filter` narrows the grid by type.
- `media-select` selects and deselects cards.
- `media-delete` removes one asset and its file.
- `media-bulk-delete` removes many assets and their files.
- `media-drive-tab` shows the Google Drive tab.
- `media-folder-create` creates a folder from the page header and refuses a duplicate name in the same business.
- `media-folder-filter` narrows the gallery to All assets, Unfiled or one folder, and defaults to Unfiled.
- `media-folder-count` renders each folder option as `name (count)`.
- `media-folder-move` moves the selected assets into a chosen folder.
- `media-folder-move-unfiled` moves a selection back to Unfiled, which is a move and not a delete.
- `media-folder-move-partial` reports a partial move when an asset belongs to another account.
- `media-folder-adopt` files an asset that has no business into the current one.
- `media-folder-delete` deletes a folder and returns its assets to Unfiled.

## How to get to it (user POV)

- Choose **Media** in the sidebar.
- Choose the first **Upload Assets** button on the gallery to open the uploader.
- Choose **New Folder** in the gallery header, beside **Upload Assets**, to open the folder dialog.
- Use the Folder filter in the Library tab's filter row to reach every folder.
- Open `/app/media/upload` directly.

## Driving it with Playwright

Preconditions:

- Doctor passes.
- A throwaway user is logged in and **owns a business**. Assets are
  business-scoped, and so are folders.
- Write a real fixture to disk first, for example
  `await writeFile('/tmp/verify-asset.png', pngBuffer)`, so the upload is a
  genuine file transfer rather than an intercepted route.
- The rejection steps need a second throwaway user with its own asset, because an
  asset owned by another account can never be adopted or filed.

- **Open the gallery.** Navigate. Run `page.goto('http://localhost:3000/app/media')` then `waitForHydration(page)`. The `h1` reads `Asset Gallery`. With no assets the counts read `0 Total Files` and the panel shows `No Assets Found` above `Upload your first asset to get started.`
- **Open the uploader.** Choose the first **Upload Assets** button. Run `page.getByRole('button', { name: 'Upload Assets' }).first().click()`. A dialog named `Upload Assets` opens with the heading `Drop Your Premium Assets Here` and the line `Select multiple files up to 800MB each for optimal quality`.
- **Upload a valid file.** Choose a file. Run `page.locator('input[type="file"]').setInputFiles('/tmp/verify-asset.png')`. The dialog shows `Upload Progress`, `0 / 1 completed`, and a `verify-asset.png` entry reading `Upload completed successfully`.
- **Prove a bad type is refused.** Offer a PDF. Run `page.locator('input[type="file"]').setInputFiles('/tmp/verify-asset.pdf')`. Two error elements are present and no success text is present. Assert both halves, because a silent success here is the exact defect this step guards.
- **Second view: the card.** Reload the gallery. Run `page.goto('http://localhost:3000/app/media')` then `waitForHydration(page)`. `No Assets Found` is gone, the counts read `1 Total Files`, and a card headed `verify-asset.png` holds an image whose `src` is `/api/v1/assets/serve/<uuid>.png`.
- **Second view: the API.** List the assets. Run `authed.get('/api/v1/assets?own=true&limit=50')`. The array sits directly on `body.data` and the entry reports `originalName: 'verify-asset.png'`.
- **Filter.** Choose a type. Run the `All Files` combobox and select the image type. Only image assets remain.
- **Select.** Run `page.getByRole('button', { name: 'Select All' }).click()`. `Deselect All` becomes enabled and the file count updates.
- **Open the folder dialog.** Choose **New Folder** in the page header. Run `page.getByRole('button', { name: 'New Folder' }).click()`. A dialog titled `Create New Folder` opens showing `Folders are per business. New assets start unfiled.` above a textbox whose placeholder is `Enter folder name`, with a `Cancel` button and a `Create Folder` button.
- **Prove the dialog starts blocked.** Run `await expect(page.getByRole('button', { name: 'Create Folder' })).toBeDisabled()`. It stays disabled until the field has content, so assert before you click or the click waits out the timeout.
- **Name it.** Run `page.getByPlaceholder('Enter folder name').fill('Campaigns')`. The `Create Folder` button becomes enabled.
- **Commit it.** Run `page.getByRole('button', { name: 'Create Folder' }).click()`. The dialog closes and a toast reads `Folder "Campaigns" created.`
- **Second view: the folders API.** Run ``authed.get(`/api/v1/assets/folders?businessId=${business.id}`)``. The array sits directly on `body.data` as `{ id, name, createdAt, assetCount }` and the new folder reports `name: 'Campaigns'` with `assetCount: 0`.
- **Create over HTTP.** Run ``authed.post('/api/v1/assets/folders', { data: { businessId, name } })``. The created folder comes back on `body.data`.
- **Refuse a duplicate.** Reopen the dialog and submit `Campaigns` again. The server answers HTTP 409 with `A folder with that name already exists`. Assert the status, because a generic failure would hide the conflict.
- **Filter by folder.** The Library tab's filter row reads `Folder:` and its combobox shows `Unfiled`, which is the default on arrival. Run `page.getByRole('combobox').first().click()`, since the folder control carries no accessible name and sits first in the filter row. The options read `All assets`, `Unfiled`, then one per folder as `name (count)`. Choose `Campaigns` and only its assets remain.
- **Move a selection.** Tick the asset cards, or run `page.getByRole('button', { name: 'Select All' }).click()` once. The badge beside it reads `1 selected`, and a second combobox appears in the toolbar. Choose the destination with a real Playwright click, then run `page.getByRole('button', { name: 'Move selected' }).click()`. The toast reads `1 asset(s) moved.`
- **Second view: the move.** Re-read both listings. Run ``authed.get(`/api/v1/assets?businessId=${business.id}&folderId=unfiled`)`` and then ``authed.get(`/api/v1/assets?businessId=${business.id}&folderId=${folderId}`)``. The asset sits in exactly one of the two, so the listing that contains it names where it went.
- **Move back to Unfiled.** With a selection, choose `Unfiled` as the destination and click `Move selected` again. The toast reads the same `N asset(s) moved.` and the asset returns to the Unfiled listing. Nothing is deleted. Over HTTP the same move is ``authed.post('/api/v1/assets/move', { data: { businessId, folderId: null, assetIds } })``.
- **Prove a partial move.** Send a move over HTTP that mixes your asset with the second user's. Run ``authed.post('/api/v1/assets/move', { data: { businessId, folderId, assetIds: [ownId, foreignId] } })``. The payload reports `moved: 1` and lists the foreign id as rejected. The UI copy for that outcome is `Moved 1 of 2; the rest belong to another account.`
- **Prove a wholly foreign move.** Send only the second user's asset. The payload reports `moved: 0` and lists it as rejected, because an asset owned by another account can never be adopted.
- **Prove `folderId` needs a business.** Run `authed.get('/api/v1/assets?folderId=whatever')` with no `businessId`. It answers HTTP 400 with `folderId requires businessId`. A folder belongs to a business, so this is deliberate and never a silent fall-through.
- **Delete a folder.** Filter into the folder first, because `Delete folder Campaigns` only renders while that folder is the active filter. Choose it and the toast reads `Folder "Campaigns" deleted. 2 asset(s) moved to Unfiled.` The proof is `GET /api/v1/assets?businessId=<id>&folderId=unfiled`, which lists both assets again.
- **Second view: the delete.** Run ``authed.delete(`/api/v1/assets/folders/${folderId}?businessId=${business.id}`)``. It returns `{ id, unfiledCount }` on `body.data`, and `unfiledCount` matches the number of assets you just recovered.
- **Open the dedicated route.** Navigate. Run `page.goto('http://localhost:3000/app/media/upload')` then `waitForHydration(page)`. The `h1` reads `Upload Assets`. The same uploader renders here, so the same file input handle and the same accept rules apply.
- **Clean up.** Delete the fixture asset. Delete removes the binary as well as the row, so a delete proof has to check both.
- **Proof.** Write to `.cursor/skills/verify-magicsync/evidence/media-assets/`: the empty gallery, the refused type, the upload progress, the card after a reload, the blocked folder dialog, the Folder filter with counts, the move toast, and the delete toast.

## Gotchas

- **The two pages have different headings.** `/app/media` reads `Asset Gallery` and `/app/media/upload` reads `Upload Assets`. Never treat a matching `h1` as proof of which route you reached.
- **The drop zone badges lie about documents.** The zone advertises `Documents PDF, DOC, TXT`, but the input accepts only `image/*,video/*`, so a PDF, DOC or TXT is rejected. Assert the rejection, never the badge.
- **The file input only exists while the uploader is open.** On the gallery it arrives with the dialog. Locate it after the dialog is open, not before.
- **`Upload Assets` matches two buttons** on the gallery, one above the grid and one below it. Use `.first()` or scope to the container.
- **`GET /api/v1/assets` needs a scope.** With neither `own=true` nor a `businessId` query param it returns an empty list, which reads as a missing row. Always pass `own=true`.
- **Unfiled is `folderId=unfiled`, not `scope=unfiled`.** The list route's zod schema at `packages/assets/server/api/v1/assets/index.get.ts:6` declares `folderId` and no `scope`, so zod strips `scope` and the query silently returns the WHOLE business listing. That is a false pass whenever every asset happens to be unfiled, which is exactly the state a fresh test account is in. Prove a filter with one asset filed and one unfiled, then read both listings to confirm the asset moved.
- **An option value can never be an empty string.** A `USelect` option whose value is `''` throws a reka-ui invariant and takes the whole page to a 500. The All assets option therefore carries the literal token `all`.
- **The selection badge counts the selection.** It reads `N selected` and sits beside `Select All`, so it is never a total of the gallery.
- **The Folder select carries no accessible name.** The `Folder:` label is a bare sibling with no `for`, so `getByRole('combobox', { name: /folder/i })` matches nothing. Scope to the filter row and take the first combobox.
- **The move destination combobox only exists once something is selected.** With an empty selection the toolbar has no destination control, so a step that goes straight for it matches nothing.
- **`Select All` is a toggle.** Clicking it twice deselects. One click per drive, and assert the badge after each.
- **Assets can arrive with no business.** Pexels and Google Drive imports create that shape, and those rows show in the gallery but had nowhere to file until a move adopted them into the current business. An asset owned by a different account is never adopted.
- **The upload field name is `files`.** Posting `file` answers HTTP 400 with `No files uploaded`.
- **A refusal must raise error text and no success text.** Until 2026-10-04 the uploader raised a success toast when every file failed, and neither page listened for the failure at all, so refusals were silent. A drive that only checks for a toast passes on that build. Check the toast copy is translated, since a raw dotted key there means a locale file lost it.
- **Card action buttons carry no accessible name.** The grid's buttons render unnamed, so scope an action to the card holding the filename heading instead of clicking by position across the page.
- **Always read the asset back after a reload.** The optimistic grid shows a card before the row is committed, so a card alone proves nothing.
- **Delete has to remove the file too.** Single delete and bulk delete both unlink the binary and tolerate a file that is already gone. A delete proof that only checks the row misses a stranded file, which is what bulk delete used to leave behind.
- **Uploaded binaries are real files and real rows.** Use a throwaway user and delete the asset during cleanup.
- **`packages/site/.gitignore` ignores `test-results`.** Never place fixtures or evidence there. Playwright wipes that directory at the start of every run.

## Migration and storage

Nothing below is drivable, so read it before you touch the database or a stored
file.

- **Folders have no sentinel row.** "No folder" is `assets.folder_id IS NULL`. A
  sentinel would be a real row a user can rename, which turns Unfiled into a
  category and makes a folder delete hide assets instead of unfiling them. The
  delete route reports `unfiledCount` so a run can prove nothing was lost.
- **The folder migration is now `0010_asset-folders-and-agent-content.sql`.** On
  2026-10-04 migrations 0010 to 0016 were squashed into that single file, because
  `origin/main` only carries 0000 to 0009 and those are the ones deployed databases
  track. It adds `asset_folders`, `assets.folder_id` and the supporting indexes.
  Columns added by `ALTER TABLE` in the old chain, such as `content_artifacts.revisions`
  and `content_items.format`, now appear inline in their `CREATE TABLE`.
- **`pnpm db:migrate` DOES replay the full chain.** An earlier note here claimed
  migration 0007's Postgres `ALTER COLUMN` syntax made a full replay impossible.
  That was wrong. A fresh-database migrate of 0000 through the squashed 0010 was
  run on 2026-10-04 and reported `migrations applied successfully`, yielding 63
  tables with `asset_folders` present and `assets.folder_id` present. Verify a
  replay like this before believing a claim that it cannot be done:
  `rm -f /tmp/test-squash.db && NUXT_TURSO_DATABASE_URL="file:/tmp/test-squash.db"
  pnpm exec drizzle-kit migrate --config ./config/drizzle.config.ts`.
- **A pre-existing quirk still stands.** The dev Turso database's
  `__drizzle_migrations` holds 26 rows against a shorter journal because earlier
  squashes orphaned entries, so on THAT database `db:migrate` does not behave like
  a clean replay. That is a property of the dev ledger, not of the migration files.
- **`metadata.storedPath` is a bare filename, never a full path.** Binaries live
  on local disk by default under `NUXT_FILE_STORAGE_MOUNT` (default
  `./upload/files`) as `userFiles/<userId>/`. The serve route
  `packages/assets/server/api/v1/assets/serve/[filename].get.ts` splits the URL
  filename on its first dot and looks the row up by the id before the extension,
  so a proof that joins `storedPath` onto the mount finds nothing.
- **Object storage is opt-in and greenfield.** An `AssetBlobStore` interface with
  `put` and `get` sits inside the single write funnel. `LocalAssetBlobStore` is
  the default and byte-identical to the previous behaviour, and
  `S3AssetBlobStore` covers AWS S3, Cloudflare R2, MinIO and Backblaze B2 behind
  one adapter. Switch it with `NUXT_ASSET_STORAGE_DRIVER` (default `local`) plus
  `NUXT_ASSET_STORAGE_S3_ENDPOINT`, `_S3_REGION`, `_S3_BUCKET`,
  `_S3_ACCESS_KEY_ID`, `_S3_SECRET_ACCESS_KEY` and the optional
  `_S3_PUBLIC_BASE_URL`.
- **`serve/[...path].get.ts` has no remote backend and no ownership check, on
  purpose.** Do not add either during a drive. Report it as a finding instead.
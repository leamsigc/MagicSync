/**
 * Which bucket of assets a listing covers. A sum type, so `folderId: ''` and
 * `folderId: 'null'` have nowhere to live — they parse to `all` at the boundary.
 *
 * `unfiled` means `assets.folder_id IS NULL`. It is never a sentinel folder row: a
 * sentinel is a real row a user can rename, so "Unfiled" would silently become a
 * category and deleting a folder would hide assets instead of unfiling them.
 */
export type FolderScope =
  | { kind: 'all' }
  | { kind: 'unfiled' }
  | { kind: 'folder'; id: string }

/**
 * Folder plus its asset count in ONE shape, so a caller never zips two responses.
 * This is a query projection, not an `AssetFolder` row: it deliberately carries no
 * `businessId` or `userId`, which keeps this isomorphic file free of the DB schema.
 */
export type AssetFolderSummary = {
  id: string
  name: string
  createdAt: Date
  assetCount: number
}

const UNFILED_SCOPE_TOKEN = 'unfiled'

/**
 * A select control needs a value for every option, and reka-ui rejects an empty
 * string with a thrown invariant, so the UI needs a non-empty token for "all".
 * This is display-layer only: `folderScopeToken` still serialises `all` to
 * `undefined` so the query omits `folderId` entirely.
 */
export const ALL_SCOPE_TOKEN = 'all'

export function parseFolderScope(raw: unknown): FolderScope {
  if (typeof raw !== 'string') return { kind: 'all' }
  const token = raw.trim()
  if (!token || token.toLowerCase() === 'null') return { kind: 'all' }
  const lowered = token.toLowerCase()
  if (lowered === UNFILED_SCOPE_TOKEN) return { kind: 'unfiled' }
  if (lowered === ALL_SCOPE_TOKEN) return { kind: 'all' }
  return { kind: 'folder', id: token }
}

/** The wire token for a scope. `all` is absence, so it serialises to nothing. */
export function folderScopeToken(scope: FolderScope): string | undefined {
  if (scope.kind === 'unfiled') return UNFILED_SCOPE_TOKEN
  if (scope.kind === 'folder') return scope.id
  return undefined
}

export type MoveAssetsInput = {
  assetIds: string[]
  businessId: string
  /** `null` moves the assets back to the unfiled bucket. */
  folderId: string | null
}
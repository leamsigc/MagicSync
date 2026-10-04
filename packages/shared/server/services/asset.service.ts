import { eq, and, sql, or, inArray, isNull, type SQL } from 'drizzle-orm';
import type { H3Event } from 'h3';
import {
  type ServiceResponse,
  ValidationError,
  type QueryOptions,
  type PaginationOptions,
  type FilterOptions,
  type PaginatedResponse
} from '../types';
import { assets, assetFolders, type Asset, type AssetFolder } from '#layers/BaseDB/db/schema';
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { parseFolderScope, type AssetFolderSummary, type FolderScope, type MoveAssetsInput } from '#layers/BaseShared/shared/utils/asset-folders';
import { assetBlobKey, useAssetBlobStore } from './asset-blob-store';

export type CreateAssetData = {
  businessId?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
};

export type AssetMetadata = {
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  storagePath?: string;
  [key: string]: unknown;
};

export type AssetFromUrlInput = {
  url: string;
  businessId?: string;
  originalName?: string;
};

export type AssetFromBase64Input = {
  data: string;
  mimeType: string;
  businessId?: string;
  originalName?: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  txt: 'text/plain',
};

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
}

function extFromMime(mimeType: string): string {
  const entry = Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType);
  return entry ? entry[0] as string : 'bin';
}

export type FileUploadOptions = {
  maxSize?: number;
  allowedMimeTypes?: string[];
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  quality?: number;
};

/**
 * Folder scoping lives in `shared/utils/asset-folders` so the client composable and this
 * service agree on one definition of the scope, the summary, and the wire token.
 */
export type {
  AssetFolderSummary,
  FolderScope,
  MoveAssetsInput,
} from '#layers/BaseShared/shared/utils/asset-folders'

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

type AssetQueryFilters = { mimeType?: string; folder: FolderScope };

function parseAssetFilters(raw: FilterOptions | undefined): AssetQueryFilters {
  const filters = raw ?? {};
  const mimeType = filters.mimeType;
  return {
    mimeType: typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : undefined,
    folder: parseFolderScope(filters.folderId),
  };
}

function folderPredicate(scope: FolderScope): SQL | undefined {
  if (scope.kind === 'unfiled') return isNull(assets.folderId);
  if (scope.kind === 'folder') return eq(assets.folderId, scope.id);
  return undefined;
}

/**
 * The ownership predicate is an OR over business and user. That OR is the only reason
 * Pexels and Google Drive imports — which carry no `business_id` — stay visible, so the
 * folder predicate joins it as a SIBLING `and` and never replaces it.
 */
function buildAssetWhere(ownership: SQL | undefined, rawFilters: FilterOptions | undefined): SQL | undefined {
  const filters = parseAssetFilters(rawFilters);
  const parts = [
    ownership,
    folderPredicate(filters.folder),
    filters.mimeType ? sql`${assets.mimeType} LIKE ${`${filters.mimeType}%`}` : undefined,
  ].filter((part): part is SQL => part !== undefined);
  if (parts.length === 1) return parts[0];
  return parts.length > 0 ? and(...parts) : undefined;
}

function pageWindow(pagination: PaginationOptions = {}): { page: number; limit: number; offset: number } {
  const page = pagination.page || DEFAULT_PAGE;
  const limit = pagination.limit || DEFAULT_LIMIT;
  return { page, limit, offset: (page - 1) * limit };
}

function paginationMeta(page: number, limit: number, count: number) {
  return { page, limit, total: count, totalPages: Math.ceil(count / limit) };
}

function isUniqueViolation(error: unknown): boolean {
  if (String(error).includes('UNIQUE constraint failed')) return true;
  // Drizzle wraps driver failures in a DrizzleQueryError whose message is
  // "Failed query: <sql>" and parks the driver's own text on `.cause`, so the
  // constraint message is only reachable there.
  const cause = (error as { cause?: unknown })?.cause;
  return cause ? String(cause).includes('UNIQUE constraint failed') : false;
}

/** Ownership gate outcome. Never `FORBIDDEN` — that would confirm another business's folder exists. */
type BusinessGate = { ok: true } | { ok: false; error: string; code: string };

/**
 * The rows a move may touch. An asset already in the business always qualifies.
 * An asset with no business qualifies ONLY for the user who owns it, which is what
 * lets a Pexels or Drive import be adopted by filing it. Someone else's unowned
 * asset never matches, so adoption cannot be used to claim another account's row.
 */
function moveOwnership(businessId: string, userId: string): SQL {
  return or(
    eq(assets.businessId, businessId),
    and(isNull(assets.businessId), eq(assets.userId, userId)),
  );
}

/** Filing an unowned asset adopts it into the business. Unfiling never adopts. */
function movePatch(folderId: string | null, businessId: string): Partial<Asset> {
  if (folderId === null) return { folderId };
  return { folderId, businessId: sql`coalesce(${assets.businessId}, ${businessId})` };
}

export type ProcessedFile = {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata?: AssetMetadata;
};

export class AssetService {
  private db = useDrizzle();

  async getAssetByFilename(filename: string): Promise<Asset | undefined> {
    return await this.db.query.assets.findFirst({
      where: eq(assets.filename, filename)
    });
  }

  async findByUserId(userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<Asset>> {
    const { page, limit, offset } = pageWindow(options.pagination);
    const whereClause = buildAssetWhere(eq(assets.userId, userId), options.filters);

    const assetList = await this.db
      .select()
      .from(assets)
      .where(whereClause)
      .orderBy(sql`${assets.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const count = await this.countAssets(whereClause);

    return {
      success: true,
      data: assetList,
      pagination: paginationMeta(page, limit, count),
    };
  }

  private async countAssets(whereClause: SQL | undefined): Promise<number> {
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause);
    return countResult[0]?.count ?? 0;
  }

  async create(userId: string, data: CreateAssetData): Promise<ServiceResponse<Asset>> {
    try {
      this.validateCreateData(data);

      const id = crypto.randomUUID();
      const now = new Date();

      const [asset] = await this.db.insert(assets).values({
        id,
        userId,
        ...data,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: now,
      }).returning();

      return { success: true, data: asset };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message, code: error.code };
      }
      return { success: false, error: 'Failed to create asset' };
    }
  }

  async findById(id: string, userId: string): Promise<ServiceResponse<Asset>> {
    try {
      const asset = await this.db.query.assets.findFirst({
        where: and(eq(assets.id, id), eq(assets.userId, userId)),
      });

      if (!asset) {
        return { success: false, error: 'Asset not found', code: 'NOT_FOUND' };
      }

      return { success: true, data: asset };
    } catch (error) {
      return { success: false, error: 'Failed to fetch asset' };
    }
  }

  async findByBusinessId(businessId: string, userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<Asset>> {
    try {
      const { page, limit, offset } = pageWindow(options.pagination);
      const whereClause = buildAssetWhere(
        or(eq(assets.businessId, businessId), eq(assets.userId, userId)),
        options.filters,
      );

      const assetList = await this.db
        .select()
        .from(assets)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${assets.createdAt} DESC`);

      const count = await this.countAssets(whereClause);

      return {
        success: true,
        data: assetList,
        pagination: paginationMeta(page, limit, count),
      };
    } catch (error) {
      return { success: false, error: 'Failed to fetch assets' };
    }
  }

  async findByIds(ids: string[], userId: string): Promise<ServiceResponse<Asset[]>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: [] };
      }

      const assetList = await this.db.query.assets.findMany({
        where: and(
          inArray(assets.id, ids),
          eq(assets.userId, userId)
        ),
      });

      // Preserve requested order — DB IN clause does not guarantee ordering
      const byId = new Map(assetList.map(asset => [asset.id, asset]));
      const ordered = ids.map(id => byId.get(id)).filter((asset): asset is Asset => !!asset);

      return { success: true, data: ordered };
    } catch (error) {
      return { success: false, error: 'Failed to fetch assets' };
    }
  }

  async getStorageUsage(userId: string): Promise<ServiceResponse<{ totalSize: number; count: number }>> {
    try {
      const [result] = await this.db
        .select({
          totalSize: sql<number>`COALESCE(SUM(${assets.size}), 0)`,
          count: sql<number>`COUNT(*)`
        })
        .from(assets)
        .where(eq(assets.userId, userId));

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: 'Failed to get storage usage' };
    }
  }

  async getStorageUsageByBusiness(businessId: string, userId: string): Promise<ServiceResponse<{ totalSize: number; count: number }>> {
    try {
      const [result] = await this.db
        .select({
          totalSize: sql<number>`COALESCE(SUM(${assets.size}), 0)`,
          count: sql<number>`COUNT(*)`
        })
        .from(assets)
        .where(and(
          eq(assets.businessId, businessId),
          eq(assets.userId, userId)
        ));

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: 'Failed to get storage usage' };
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<Asset>> {
    try {
      const existingResult = await this.findById(id, userId);
      if (!existingResult.success) {
        return existingResult;
      }

      const [deleted] = await this.db
        .delete(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .returning();

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: 'Failed to delete asset' };
    }
  }

  async deleteMultiple(ids: string[], userId: string): Promise<ServiceResponse<Asset[]>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: [] };
      }

      const deleted = await this.db
        .delete(assets)
        .where(and(
          inArray(assets.id, ids),
          eq(assets.userId, userId)
        ))
        .returning();

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: 'Failed to delete assets' };
    }
  }

  async updateMetadata(id: string, userId: string, metadata: AssetMetadata): Promise<ServiceResponse<Asset>> {
    try {
      const [updated] = await this.db
        .update(assets)
        .set({
          metadata: JSON.stringify(metadata),
        })
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .returning();

      if (!updated) {
        return { success: false, error: 'Asset not found', code: 'NOT_FOUND' };
      }

      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: 'Failed to update asset metadata' };
    }
  }

  private validateCreateData(data: CreateAssetData): void {
    if (!data.filename || data.filename.trim().length === 0) {
      throw new ValidationError('Filename is required', 'filename');
    }

    if (!data.originalName || data.originalName.trim().length === 0) {
      throw new ValidationError('Original name is required', 'originalName');
    }

    if (!data.mimeType || data.mimeType.trim().length === 0) {
      throw new ValidationError('MIME type is required', 'mimeType');
    }

    if (!data.url || data.url.trim().length === 0) {
      throw new ValidationError('URL is required', 'url');
    }

    if (data.size <= 0) {
      throw new ValidationError('File size must be greater than 0', 'size');
    }

    if (data.thumbnailUrl) {
      try {
        new URL(data.thumbnailUrl);
      } catch {
        throw new ValidationError('Invalid thumbnail URL format', 'thumbnailUrl');
      }
    }
  }

  isImageAsset(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isVideoAsset(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  getAssetType(mimeType: string): 'image' | 'video' | 'document' | 'other' {
    if (this.isImageAsset(mimeType)) return 'image';
    if (this.isVideoAsset(mimeType)) return 'video';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
    return 'other';
  }

  async createFromUrl(userId: string, input: AssetFromUrlInput): Promise<ServiceResponse<Asset>> {
    try {
      if (!/^https?:\/\//i.test(input.url)) {
        return { success: false, error: 'Only http(s) URLs can be imported' };
      }
      const originalName = input.originalName || input.url.split('/').pop() || 'downloaded-asset';
      const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
      const downloaded: unknown = await $fetch(input.url);
      const arrayBuffer = downloaded instanceof Blob ? await downloaded.arrayBuffer() : downloaded as ArrayBuffer;
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        return { success: false, error: 'Downloaded file is empty' };
      }
      return await this.storeBuffer(userId, buffer, {
        originalName,
        ext,
        mimeType: mimeFromFilename(originalName),
        businessId: input.businessId,
        metadata: { sourceUrl: input.url },
      });
    } catch (error) {
      log.error({ message: 'assetService.createFromUrl failed', error: String(error) });
      return { success: false, error: 'Failed to import asset from URL' };
    }
  }

  async createFromBase64(userId: string, input: AssetFromBase64Input): Promise<ServiceResponse<Asset>> {
    try {
      const match = input.data.match(/^data:([^;]+);base64,(.*)$/s);
      const mimeType = match?.[1] ?? input.mimeType;
      const payload = (match?.[2] ?? input.data).replace(/\s+/g, '');
      const buffer = Buffer.from(payload, 'base64');
      if (buffer.length === 0) {
        return { success: false, error: 'Decoded image is empty' };
      }
      const ext = extFromMime(mimeType);
      return await this.storeBuffer(userId, buffer, {
        originalName: input.originalName || `upload.${ext}`,
        ext,
        mimeType,
        businessId: input.businessId,
        metadata: { inlineUpload: true },
      });
    } catch (error) {
      log.error({ message: 'assetService.createFromBase64 failed', error: String(error) });
      return { success: false, error: 'Failed to create asset from inline image' };
    }
  }

  private async storeBuffer(
    userId: string,
    buffer: Buffer,
    file: { originalName: string; ext: string; mimeType: string; businessId?: string; metadata?: Record<string, unknown> }
  ): Promise<ServiceResponse<Asset>> {
    const uniqueFilename = crypto.randomUUID();
    const fullFilename = `${uniqueFilename}.${file.ext}`;
    const { url } = await useAssetBlobStore().put(
      assetBlobKey(userId, fullFilename),
      buffer,
      file.mimeType,
    );
    return this.create(userId, {
      businessId: file.businessId,
      filename: uniqueFilename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: buffer.length,
      url,
      metadata: {
        uploadedAt: new Date(),
        originalSize: buffer.length,
        // BARE filename, never the object key: serve/[filename].get.ts resolves the
        // asset from the first dot-segment of the stored name.
        storedPath: fullFilename,
        ...file.metadata,
      },
    });
  }

  private async gateBusiness(businessId: string, userId: string, event?: H3Event): Promise<BusinessGate> {
    const result = await businessProfileService.findById(businessId, userId, event);
    if (result.success) return { ok: true };
    return { ok: false, error: 'Business not found', code: 'NOT_FOUND' };
  }

  /** Folder plus its asset count in one returned shape, so the UI never zips two calls. */
  async listFolders(businessId: string, userId: string, event?: H3Event): Promise<ServiceResponse<AssetFolderSummary[]>> {
    const gate = await this.gateBusiness(businessId, userId, event);
    if (!gate.ok) return { success: false, error: gate.error, code: gate.code };

    try {
      // A correlated subquery is wrong here: drizzle renders a bare column inside a
      // `sql` fragment unqualified, so `assets.folder_id = assetFolders.id` comes out as
      // `"folder_id" = "id"` and the inner `"id"` binds to assets.id, making every count 0.
      // A LEFT JOIN keeps both sides table-qualified and count(assets.id) yields 0 for an
      // empty folder rather than 1 from the outer row.
      const folderList = await this.db
        .select({
          id: assetFolders.id,
          name: assetFolders.name,
          createdAt: assetFolders.createdAt,
          assetCount: sql<number>`count(${assets.id})`,
        })
        .from(assetFolders)
        .leftJoin(assets, eq(assets.folderId, assetFolders.id))
        .where(eq(assetFolders.businessId, businessId))
        .groupBy(assetFolders.id, assetFolders.name, assetFolders.createdAt)
        .orderBy(sql`${assetFolders.createdAt} DESC`);

      return { success: true, data: folderList };
    } catch (error) {
      log.error({ message: 'assetService.listFolders failed', businessId, error: String(error) });
      return { success: false, error: 'Failed to list asset folders' };
    }
  }

  async createFolder(
    businessId: string,
    userId: string,
    name: string,
    event?: H3Event
  ): Promise<ServiceResponse<AssetFolder>> {
    const gate = await this.gateBusiness(businessId, userId, event);
    if (!gate.ok) return { success: false, error: gate.error, code: gate.code };

    const folderName = name.trim();
    if (!folderName) return { success: false, error: 'Folder name is required', code: 'VALIDATION' };

    try {
      return await this.insertFolder(userId, businessId, folderName);
    } catch (error) {
      // The unique index on (business_id, name) is the duplicate guard, not a read-then-write.
      if (isUniqueViolation(error)) {
        return { success: false, error: 'A folder with that name already exists', code: 'CONFLICT' };
      }
      log.error({ message: 'assetService.createFolder failed', businessId, error: String(error) });
      return { success: false, error: 'Failed to create asset folder' };
    }
  }

  private async insertFolder(userId: string, businessId: string, name: string): Promise<ServiceResponse<AssetFolder>> {
    const [folder] = await this.db.insert(assetFolders).values({
      id: crypto.randomUUID(),
      userId,
      businessId,
      name,
    }).returning();
    if (!folder) return { success: false, error: 'Failed to create asset folder' };
    return { success: true, data: folder };
  }

  /** `unfiledCount` is how many assets fell back to the unfiled bucket as a result. */
  async deleteFolder(
    id: string,
    businessId: string,
    userId: string,
    event?: H3Event
  ): Promise<ServiceResponse<{ id: string; unfiledCount: number }>> {
    const gate = await this.gateBusiness(businessId, userId, event);
    if (!gate.ok) return { success: false, error: gate.error, code: gate.code };

    try {
      return await this.db.transaction(async (tx) => {
        // Clear references BEFORE deleting the row: the generated DDL carries no
        // ON DELETE SET NULL, so the fallback is explicit and atomic rather than
        // delegated to the FK engine.
        const cleared = await tx.update(assets)
          .set({ folderId: null })
          .where(and(eq(assets.folderId, id), eq(assets.businessId, businessId)))
          .returning({ id: assets.id });

        const [deleted] = await tx.delete(assetFolders)
          .where(and(eq(assetFolders.id, id), eq(assetFolders.businessId, businessId)))
          .returning({ id: assetFolders.id });

        if (!deleted) return { success: false as const, error: 'Folder not found', code: 'NOT_FOUND' };
        return { success: true as const, data: { id: deleted.id, unfiledCount: cleared.length } };
      });
    } catch (error) {
      log.error({ message: 'assetService.deleteFolder failed', folderId: id, businessId, error: String(error) });
      return { success: false, error: 'Failed to delete asset folder' };
    }
  }

  async moveToFolder(
    input: MoveAssetsInput,
    userId: string,
    event?: H3Event
  ): Promise<ServiceResponse<{ moved: number; rejected: string[] }>> {
    const { assetIds, businessId, folderId } = input;
    const gate = await this.gateBusiness(businessId, userId, event);
    if (!gate.ok) return { success: false, error: gate.error, code: gate.code };
    if (assetIds.length === 0) return { success: true, data: { moved: 0, rejected: [] } };

    try {
      const target = await this.resolveFolder(businessId, folderId);
      if (!target.ok) return { success: false, error: target.error, code: target.code };

      // Single statement, no check-then-write: the folder is resolved by id AND
      // business, and the update only touches assets this user may move.
      const moved = await this.db.update(assets)
        .set(movePatch(folderId, businessId))
        .where(and(inArray(assets.id, assetIds), moveOwnership(businessId, userId)))
        .returning({ id: assets.id });

      const movedIds = new Set(moved.map(row => row.id));
      return {
        success: true,
        data: { moved: movedIds.size, rejected: assetIds.filter(id => !movedIds.has(id)) },
      };
    } catch (error) {
      log.error({ message: 'assetService.moveToFolder failed', businessId, error: String(error) });
      return { success: false, error: 'Failed to move assets' };
    }
  }

  private async resolveFolder(businessId: string, folderId: string | null): Promise<BusinessGate> {
    if (folderId === null) return { ok: true };
    const [folder] = await this.db
      .select({ id: assetFolders.id })
      .from(assetFolders)
      .where(and(eq(assetFolders.id, folderId), eq(assetFolders.businessId, businessId)))
      .limit(1);
    if (folder) return { ok: true };
    return { ok: false, error: 'Folder not found', code: 'NOT_FOUND' };
  }
}

export const assetService = new AssetService();

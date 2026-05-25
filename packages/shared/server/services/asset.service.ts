import { eq, and, sql, or, inArray } from 'drizzle-orm';
import {
  type ServiceResponse,
  ValidationError,
  type QueryOptions,
  type PaginatedResponse
} from '../types';
import { assets, type Asset } from '#layers/BaseDB/db/schema';

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

export type FileUploadOptions = {
  maxSize?: number;
  allowedMimeTypes?: string[];
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  quality?: number;
};

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
    const { pagination = { page: 1, limit: 20 }, filters = {} } = options;
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const offset = (page - 1) * limit;

    const whereClause = eq(assets.userId, userId);

    const assetList = await this.db.query.assets.findMany({
      where: whereClause,
      orderBy: sql`${assets.createdAt} DESC`,
      limit,
      offset,
    });

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause);
    const count = countResult[0]?.count ?? 0;

    return {
      success: true,
      data: assetList,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
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
      const { pagination = { page: 1, limit: 20 }, filters = {} } = options;
      const page = pagination.page || 1;
      const limit = pagination.limit || 20;
      const offset = (page - 1) * limit;

      let whereConditions = or(
        eq(assets.businessId, businessId),
        eq(assets.userId, userId)
      );

      if (filters.mimeType) {
        whereConditions = and(
          whereConditions,
          sql`${assets.mimeType} LIKE ${`${filters.mimeType}%`}`
        );
      }

      const assetList = await this.db
        .select()
        .from(assets)
        .where(whereConditions)
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${assets.createdAt} DESC`);

      const countResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(whereConditions);
      const count = countResult[0]?.count ?? 0;

      return {
        success: true,
        data: assetList,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
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

      return { success: true, data: assetList };
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

      const storagePath = existingResult.data?.metadata
        ? (JSON.parse(existingResult.data.metadata as string) as AssetMetadata).storagePath
        : undefined;

      const [deleted] = await this.db
        .delete(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .returning();

      if (storagePath) {
      }

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
}

export const assetService = new AssetService();

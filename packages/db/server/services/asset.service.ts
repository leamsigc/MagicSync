import { eq, and, sql, or, inArray } from 'drizzle-orm';
import {
  type ServiceResponse,
  ValidationError,
  type QueryOptions,
  type PaginatedResponse
} from './types';
import { assets, type Asset } from '#layers/BaseDB/db/schema';

export interface CreateAssetData {
  businessId?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  [key: string]: any;
}

export interface FileUploadOptions {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  quality?: number;
}

export interface ProcessedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata?: AssetMetadata;
}

export class AssetService {
  private db = useDrizzle();

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

      return { data: asset };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { error: error.message, code: error.code };
      }
      return { error: 'Failed to create asset' };
    }
  }

  async findById(id: string, userId: string): Promise<ServiceResponse<Asset>> {
    try {
      const [asset] = await this.db
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .limit(1);

      if (!asset) {
        return { error: 'Asset not found', code: 'NOT_FOUND' };
      }

      return { data: asset };
    } catch (error) {
      return { error: 'Failed to fetch asset' };
    }
  }

  async findByBusinessId(businessId: string, userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<Asset>> {
    try {
      const { pagination = { page: 1, limit: 20 }, filters = {} } = options;
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 20);

      // Build where conditions
      let whereConditions = or(
        eq(assets.businessId, businessId),
        eq(assets.userId, userId)
      );

      // Apply mime type filter if provided
      if (filters.mimeType) {
        whereConditions = and(
          whereConditions,
          sql`${assets.mimeType} LIKE ${`${filters.mimeType}%`}`
        );
      }

      const query = this.db
        .select()
        .from(assets)
        .where(whereConditions);

      const assetList = await query
        .limit(pagination.limit || 20)
        .offset(offset)
        .orderBy(sql`${assets.createdAt} DESC`);

      // Get total count for pagination using the same where conditions
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(whereConditions);
      const count = result[0]?.count ?? 0;

      return {

        data: assetList,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 20,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 20)),
        },
      };
    } catch (error) {
      return { error: 'Failed to fetch assets' };
    }
  }

  async findByIds(ids: string[], userId: string): Promise<ServiceResponse<Asset[]>> {
    try {
      if (ids.length === 0) {
        return { data: [] };
      }

      const assetList = await this.db
        .select()
        .from(assets)
        .where(and(
          inArray(assets.id, ids),
          eq(assets.userId, userId)
        ));

      return { data: assetList };
    } catch (error) {
      return { error: 'Failed to fetch assets' };
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

      return { data: result };
    } catch (error) {
      return { error: 'Failed to get storage usage' };
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

      return { data: result };
    } catch (error) {
      return { error: 'Failed to get storage usage' };
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<Asset>> {
    try {
      // Check if asset exists and belongs to user
      const existingResult = await this.findById(id, userId);
      const storagePath = existingResult.data?.metadata ? JSON.parse(existingResult.data?.metadata).storagePath : '';
      const [deleted] = await this.db
        .delete(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .returning();



      // Deleting Files
      // await deleteFile(existingResult.data?.filename, '/userFiles');
      if (storagePath) {
        // Delete the file from storage
        // await deleteFile(storagePath);
      }

      return { data: deleted };
    } catch (error) {
      return { error: 'Failed to delete asset' };
    }
  }

  async deleteMultiple(ids: string[], userId: string): Promise<ServiceResponse<Asset[]>> {
    try {
      if (ids.length === 0) {
        return { data: [] };
      }

      const deleted = await this.db
        .delete(assets)
        .where(and(
          inArray(assets.id, ids),
          eq(assets.userId, userId)
        ))
        .returning();

      return { data: deleted };
    } catch (error) {
      return { error: 'Failed to delete assets' };
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
        return { error: 'Asset not found', code: 'NOT_FOUND' };
      }

      return { data: updated };
    } catch (error) {
      return { error: 'Failed to update asset metadata' };
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


    // Validate thumbnail URL if provided
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

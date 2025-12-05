import { eq, and, or, sql, SQL } from 'drizzle-orm';
import {
  type ServiceResponse,
  ValidationError,
  type QueryOptions,
  type PaginatedResponse
} from './types';
import { templates, templateAssets, type Template, type TemplateAsset, TemplateType } from '#layers/BaseDB/db/schema';

export interface CreateTemplateData {
  ownerId: string;
  type: typeof TemplateType[number];
  title: string;
  content: string;
  isPublic?: boolean;
  assets?: Array<{ name: string; url: string }>;
}

export interface UpdateTemplateData {
  title?: string;
  content?: string;
  isPublic?: boolean;
}

export interface TemplateWithAssets {
  id: string;
  ownerId: string;
  type: typeof TemplateType[number];
  title: string;
  content: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  assets: TemplateAsset[];
}

export class TemplateService {
  private db = useDrizzle();

  async create(userId: string, data: CreateTemplateData): Promise<ServiceResponse<TemplateWithAssets>> {
    try {
      this.validateCreateData(data);

      const id = crypto.randomUUID();
      const now = new Date();

      // Create template
      const [template] = await this.db.insert(templates).values({
        id,
        ownerId: data.ownerId,
        type: data.type,
        title: data.title,
        content: data.content,
        isPublic: data.isPublic || false,
        createdAt: now,
        updatedAt: now,
      }).returning();

      // Create template assets if provided
      let assets: TemplateAsset[] = [];
      if (data.assets && data.assets.length > 0) {
        assets = await this.createTemplateAssets(id, data.assets);
      }
      if (!template) {
        return { success: false, error: 'Failed to create template' };
      }

      return { success: true, data: { ...template, assets } };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message, code: error.code };
      }
      return { success: false, error: 'Failed to create template' };
    }
  }

  async findById(id: string, userId: string): Promise<ServiceResponse<TemplateWithAssets>> {
    try {
      const template = await this.db.query.templates.findFirst({
        where: and(eq(templates.id, id), or(eq(templates.ownerId, userId), eq(templates.isPublic, true))),
        with: {
          assets: true
        }
      });

      if (!template) {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' };
      }

      return { success: true, data: template as TemplateWithAssets };
    } catch (error) {
      return { success: false, error: 'Failed to fetch template' };
    }
  }

  async findByOwner(ownerId: string, options: QueryOptions = {}): Promise<PaginatedResponse<Template>> {
    try {
      const { pagination = { page: 1, limit: 20 }, filters = {} } = options;
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 20);

      let whereConditions = eq(templates.ownerId, ownerId);

      // Apply filters
      if (filters.type && TemplateType.includes(filters.type)) {
        whereConditions = and(whereConditions, eq(templates.type, filters.type))!;
      }
      if (filters.isPublic !== undefined) {
        whereConditions = and(whereConditions, eq(templates.isPublic, filters.isPublic))!;
      }

      const templateList = await this.db.query.templates.findMany({
        where: whereConditions,
        limit: pagination.limit || 20,
        offset,
        orderBy: (templates, { desc }) => [desc(templates.updatedAt)],
        with: {
          assets: true
        }
      });

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(templates)
        .where(whereConditions);

      const count = result[0]?.count ?? 0;

      return {
        success: true,
        data: templateList,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 20,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 20)),
        },
      };
    } catch (error) {
      return { success: false, error: 'Failed to fetch templates' };
    }
  }

  async findPublic(options: QueryOptions = {}): Promise<PaginatedResponse<Template>> {
    try {
      const { pagination = { page: 1, limit: 20 }, filters = {} } = options;
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 20);

      let whereConditions = eq(templates.isPublic, true);

      // Apply filters
      if (filters.type && TemplateType.includes(filters.type)) {
        whereConditions = and(whereConditions, eq(templates.type, filters.type))!;
      }

      const templateList = await this.db.query.templates.findMany({
        where: whereConditions,
        limit: pagination.limit || 20,
        offset,
        orderBy: (templates, { desc }) => [desc(templates.updatedAt)],
        with: {
          assets: true
        }
      });

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(templates)
        .where(whereConditions);

      const count = result[0]?.count ?? 0;

      return {
        success: true,
        data: templateList,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 20,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 20)),
        },
      };
    } catch (error) {
      return { success: false, error: 'Failed to fetch public templates' };
    }
  }

  async update(id: string, userId: string, data: UpdateTemplateData): Promise<ServiceResponse<Template>> {
    try {
      const existing = await this.findById(id, userId);
      if (!existing.success) return existing;

      const [updated] = await this.db
        .update(templates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(templates.id, id), eq(templates.ownerId, userId)))
        .returning();

      if (!updated) {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' };
      }

      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: 'Failed to update template' };
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<Template>> {
    try {
      // Check if template exists and belongs to user
      const existing = await this.findById(id, userId);
      if (!existing.success) return existing;

      // Delete template assets first (this happens via cascade)
      // Delete template
      const [deleted] = await this.db
        .delete(templates)
        .where(and(eq(templates.id, id), eq(templates.ownerId, userId)))
        .returning();

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: 'Failed to delete template' };
    }
  }

  async addAsset(templateId: string, userId: string, name: string, url: string): Promise<ServiceResponse<TemplateAsset>> {
    try {
      // Verify template ownership
      const templateCheck = await this.findById(templateId, userId);
      if (!templateCheck.success) {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' };
      };

      this.validateAssetData(name, url);

      const id = crypto.randomUUID();

      const [asset] = await this.db.insert(templateAssets).values({
        id,
        templateId,
        name,
        url,
        createdAt: new Date(),
      }).returning();

      return { success: true, data: asset };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message, code: error.code };
      }
      return { success: false, error: 'Failed to add template asset' };
    }
  }

  async removeAsset(templateId: string, assetId: string, userId: string): Promise<ServiceResponse<TemplateAsset>> {
    try {
      const templateCheck = await this.findById(templateId, userId);
      if (!templateCheck.success) {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' };
      }

      const [deleted] = await this.db
        .delete(templateAssets)
        .where(and(
          eq(templateAssets.id, assetId),
          eq(templateAssets.templateId, templateId)
        ))
        .returning();

      if (!deleted) {
        return { success: false, error: 'Asset not found', code: 'NOT_FOUND' };
      }

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: 'Failed to remove template asset' };
    }
  }

  private async createTemplateAssets(templateId: string, assets: Array<{ name: string; url: string }>): Promise<TemplateAsset[]> {
    const assetInserts = assets.map(asset => ({
      id: crypto.randomUUID(),
      templateId,
      name: asset.name,
      url: asset.url,
      createdAt: new Date(),
    }));

    const insertedAssets = await this.db.insert(templateAssets).values(assetInserts).returning();
    return insertedAssets;
  }

  private async findAssetsByTemplateId(templateId: string): Promise<TemplateAsset[]> {
    return await this.db.query.templateAssets.findMany({
      where: eq(templateAssets.templateId, templateId)
    });
  }

  private validateCreateData(data: CreateTemplateData): void {
    if (!data.ownerId || data.ownerId.trim().length === 0) {
      throw new ValidationError('Owner ID is required', 'ownerId');
    }

    if (!data.type || !TemplateType.includes(data.type)) {
      throw new ValidationError('Invalid template type', 'type');
    }

    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Title is required', 'title');
    }

    if (data.title.length > 255) {
      throw new ValidationError('Title must be less than 255 characters', 'title');
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new ValidationError('Content is required', 'content');
    }

    // Validate assets if provided
    if (data.assets) {
      data.assets.forEach((asset, index) => {
        if (!asset.name || asset.name.trim().length === 0) {
          throw new ValidationError(`Asset ${index + 1}: Name is required`, 'assets');
        }
        if (!asset.url || asset.url.trim().length === 0) {
          throw new ValidationError(`Asset ${index + 1}: URL is required`, 'assets');
        }
        try {
          new URL(asset.url);
        } catch {
          throw new ValidationError(`Asset ${index + 1}: Invalid URL format`, 'assets');
        }
      });
    }
  }

  private validateAssetData(name: string, url: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Asset name is required', 'name');
    }

    if (!url || url.trim().length === 0) {
      throw new ValidationError('Asset URL is required', 'url');
    }

    try {
      new URL(url);
    } catch {
      throw new ValidationError('Invalid URL format', 'url');
    }
  }
}

export const templateService = new TemplateService();



import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { businessProfiles, type BusinessProfile } from '#layers/BaseDB/db/business/business';
import type { BusinessServiceType } from './interfaces';

export class BusinessService implements BusinessServiceType {
  private db = useDrizzle();

  async create(data: Omit<BusinessProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<BusinessProfile> {
    const newBusiness = await this.db
      .insert(businessProfiles)
      .values({
        id: randomUUID(),
        ...data,
        isActive: !!data.googleBusinessId, // Active only if Google My Business is connected
      })
      .returning();

    if (!newBusiness[0]) {
      throw new Error('Failed to create business profile');
    }

    return newBusiness[0];
  }

  async update(id: string, data: Partial<Omit<BusinessProfile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<BusinessProfile | null> {
    const updatedBusinesses = await this.db
      .update(businessProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
        isActive: data.googleBusinessId !== undefined ? !!data.googleBusinessId : undefined, // Update active status if Google ID is provided
      })
      .where(eq(businessProfiles.id, id))
      .returning();
    return updatedBusinesses[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(businessProfiles)
      .where(eq(businessProfiles.id, id));
    return result.rowsAffected > 0;
  }

  async find(id: string): Promise<BusinessProfile | null> {
    const [business] = await this.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.id, id));
    return business || null;
  }

  async findAll(): Promise<BusinessProfile[]> {
    return await this.db
      .select()
      .from(businessProfiles);
  }

  async findByUserId(userId: string): Promise<BusinessProfile[]> {
    return await this.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));
  }

  async findBySlug(slug: string): Promise<BusinessProfile | null> {
    // Assuming slug refers to the name field since no slug column exists
    const [business] = await this.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.name, slug));
    return business || null;
  }

  async toggleGoogleMyBusinessConnection(id: string): Promise<BusinessProfile | null> {
    const business = await this.find(id);
    if (!business) return null;

    const newActiveStatus = !!business.googleBusinessId && business.isActive;
    if (newActiveStatus) {
      // Disconnect: remove Google Business ID and deactivate
      return await this.update(id, { googleBusinessId: null });
    } else if (business.googleBusinessId) {
      // If has Google ID but inactive, just toggle active
      return await this.update(id, { isActive: true });
    } else {
      // If no Google ID, toggle would require connecting, but for now just set inactive
      return await this.update(id, { isActive: false });
    }
  }
}

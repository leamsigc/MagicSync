import { eq, and, sql, desc } from 'drizzle-orm'
import { type ServiceResponse, type QueryOptions } from './types'
import type { SkillServiceType } from './interfaces'
import { skills, type Skill } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface CreateSkillData {
  name: string
  description: string
  instructions: string
  isGlobal?: boolean
}

export class SkillService implements SkillServiceType {
  private db = useDrizzle()

  async create(userId: string, data: CreateSkillData): Promise<ServiceResponse<Skill>> {
    try {
      const id = crypto.randomUUID()
      const now = new Date()

      const [skill] = await this.db.insert(skills).values({
        id,
        userId,
        name: data.name,
        description: data.description,
        instructions: data.instructions,
        isGlobal: data.isGlobal || false,
        createdAt: now,
        updatedAt: now,
      }).returning()

      return { success: true, data: skill }
    } catch (error) {
      return { success: false, error: 'Failed to create skill' }
    }
  }

  async findById(id: string, userId: string): Promise<ServiceResponse<Skill>> {
    try {
      const [skill] = await this.db
        .select()
        .from(skills)
        .where(and(eq(skills.id, id), sql`(${skills.userId} = ${userId} OR ${skills.isGlobal} = 1)`))
        .limit(1)

      if (!skill) {
        return { success: false, error: 'Skill not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: skill }
    } catch (error) {
      return { success: false, error: 'Failed to fetch skill' }
    }
  }

  async findByUser(userId: string, options: QueryOptions = {}): Promise<ServiceResponse<Skill[]>> {
    try {
      const allSkills = await this.db
        .select()
        .from(skills)
        .where(sql`(${skills.userId} = ${userId} OR ${skills.isGlobal} = 1) AND ${skills.enabled} = 1`)
        .orderBy(desc(skills.updatedAt))

      return { success: true, data: allSkills }
    } catch (error) {
      return { success: false, error: 'Failed to fetch skills' }
    }
  }

  async getCatalog(userId: string): Promise<ServiceResponse<Array<{ name: string; description: string }>>> {
    try {
      const skillCatalog = await this.db
        .select({ name: skills.name, description: skills.description })
        .from(skills)
        .where(sql`(${skills.userId} = ${userId} OR ${skills.isGlobal} = 1) AND ${skills.enabled} = 1`)

      return { success: true, data: skillCatalog }
    } catch (error) {
      return { success: false, error: 'Failed to fetch skill catalog' }
    }
  }

  async update(id: string, userId: string, data: Partial<CreateSkillData>): Promise<ServiceResponse<Skill>> {
    try {
      const [updated] = await this.db
        .update(skills)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(skills.id, id), eq(skills.userId, userId)))
        .returning()

      if (!updated) {
        return { success: false, error: 'Skill not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to update skill' }
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<Skill>> {
    try {
      const [deleted] = await this.db
        .delete(skills)
        .where(and(eq(skills.id, id), eq(skills.userId, userId)))
        .returning()

      if (!deleted) {
        return { success: false, error: 'Skill not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: deleted }
    } catch (error) {
      return { success: false, error: 'Failed to delete skill' }
    }
  }
}

export const skillService = new SkillService()
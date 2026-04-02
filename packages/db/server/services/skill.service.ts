import { eq, and, sql, desc } from 'drizzle-orm'
import { type ServiceResponse, type QueryOptions } from './types'
import { skills, skillFiles, type Skill, type SkillFile } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface CreateSkillData {
  name: string
  description: string
  instructions: string
  isGlobal?: boolean
}

export interface CreateSkillFileData {
  skillId: string
  filename: string
  mimeType: string
  size: number
  content: Buffer
  storagePath: string
}

export class SkillService {
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

      return { data: skill }
    } catch (error) {
      return { error: 'Failed to create skill' }
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
        return { error: 'Skill not found', code: 'NOT_FOUND' }
      }

      return { data: skill }
    } catch (error) {
      return { error: 'Failed to fetch skill' }
    }
  }

  async findByUser(userId: string, options: QueryOptions = {}): Promise<ServiceResponse<Skill[]>> {
    try {
      const allSkills = await this.db
        .select()
        .from(skills)
        .where(sql`(${skills.userId} = ${userId} OR ${skills.isGlobal} = 1) AND ${skills.enabled} = 1`)
        .orderBy(desc(skills.updatedAt))

      return { data: allSkills }
    } catch (error) {
      return { error: 'Failed to fetch skills' }
    }
  }

  async getCatalog(userId: string): Promise<ServiceResponse<Array<{ name: string; description: string }>>> {
    try {
      const skillCatalog = await this.db
        .select({ name: skills.name, description: skills.description })
        .from(skills)
        .where(sql`(${skills.userId} = ${userId} OR ${skills.isGlobal} = 1) AND ${skills.enabled} = 1`)

      return { data: skillCatalog }
    } catch (error) {
      return { error: 'Failed to fetch skill catalog' }
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
        return { error: 'Skill not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update skill' }
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<Skill>> {
    try {
      const [deleted] = await this.db
        .delete(skills)
        .where(and(eq(skills.id, id), eq(skills.userId, userId)))
        .returning()

      if (!deleted) {
        return { error: 'Skill not found', code: 'NOT_FOUND' }
      }

      return { data: deleted }
    } catch (error) {
      return { error: 'Failed to delete skill' }
    }
  }
}

export class SkillFileService {
  private db = useDrizzle()

  async create(userId: string, data: CreateSkillFileData): Promise<ServiceResponse<SkillFile>> {
    try {
      const id = crypto.randomUUID()
      const now = new Date()

      const [file] = await this.db.insert(skillFiles).values({
        id,
        skillId: data.skillId,
        userId,
        filename: data.filename,
        mimeType: data.mimeType,
        size: data.size,
        content: data.content,
        storagePath: data.storagePath,
        createdAt: now,
      }).returning()

      return { data: file }
    } catch (error) {
      return { error: 'Failed to create skill file' }
    }
  }

  async findBySkill(skillId: string): Promise<ServiceResponse<SkillFile[]>> {
    try {
      const files = await this.db
        .select()
        .from(skillFiles)
        .where(eq(skillFiles.skillId, skillId))

      return { data: files }
    } catch (error) {
      return { error: 'Failed to fetch skill files' }
    }
  }
}

export const skillService = new SkillService()
export const skillFileService = new SkillFileService()
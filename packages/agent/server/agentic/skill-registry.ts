import type { ExecutableSkill } from './contracts'

/** Minimal planner-facing catalog entry: id + one line. Small models only see this. */
export interface SkillCatalogEntry {
  id: string
  description: string
}

export class SkillRegistryService {
  private skills = new Map<string, ExecutableSkill>()

  register(skill: ExecutableSkill): void {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill already registered: ${skill.id}`)
    }
    this.skills.set(skill.id, skill)
  }

  unregister(id: string): void {
    this.skills.delete(id)
  }

  get(id: string): ExecutableSkill | undefined {
    return this.skills.get(id)
  }

  has(id: string): boolean {
    return this.skills.has(id)
  }

  list(): ExecutableSkill[] {
    return [...this.skills.values()]
  }

  catalog(): SkillCatalogEntry[] {
    return this.list().map(skill => ({ id: skill.id, description: skill.description }))
  }
}

export const skillRegistry = new SkillRegistryService()

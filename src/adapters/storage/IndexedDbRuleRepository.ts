import type { GameRule } from '../../domain/rules'
import { GameRuleSchema } from '../../domain/rules'
import type { RuleRepository } from '../../ports/RuleRepository'
import { getDb } from './db'

export class IndexedDbRuleRepository implements RuleRepository {
  async list(): Promise<GameRule[]> {
    const db = await getDb()
    const rows = await db.getAll('rules')
    return rows
      .map((r) => GameRuleSchema.safeParse(r))
      .filter((r) => r.success)
      .map((r) => r.data)
  }

  async save(rule: GameRule): Promise<void> {
    const db = await getDb()
    await db.put('rules', { ...rule, builtin: false })
  }

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('rules', id)
  }
}

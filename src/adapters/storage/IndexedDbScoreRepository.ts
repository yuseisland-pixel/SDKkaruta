import type { ScoreRecord } from '../../domain/score'
import { compareScores, isRankable } from '../../domain/score'
import type { ScoreRepository } from '../../ports/ScoreRepository'
import { getDb } from './db'

export class IndexedDbScoreRepository implements ScoreRepository {
  async save(record: ScoreRecord): Promise<void> {
    const db = await getDb()
    await db.put('scores', record)
  }

  async list(cardSetId: string, ruleId: string): Promise<ScoreRecord[]> {
    const db = await getDb()
    const rows = await db.getAllFromIndex('scores', 'bySetRule', [cardSetId, ruleId])
    return rows.sort((a, b) => b.playedAt.localeCompare(a.playedAt))
  }

  async getBest(cardSetId: string, ruleId: string): Promise<ScoreRecord | undefined> {
    const rows = (await this.list(cardSetId, ruleId)).filter(isRankable)
    if (rows.length === 0) return undefined
    return rows.sort(compareScores)[0]
  }

  async clear(cardSetId?: string): Promise<void> {
    const db = await getDb()
    if (!cardSetId) {
      await db.clear('scores')
      return
    }
    const tx = db.transaction('scores', 'readwrite')
    for (const row of await tx.store.getAll()) {
      if (row.cardSetId === cardSetId) await tx.store.delete(row.id)
    }
    await tx.done
  }
}

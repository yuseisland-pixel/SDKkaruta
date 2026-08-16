import type { CardSet, CardSetSummary } from '../../domain/card'
import { CardSetSchema, toSummary } from '../../domain/card'
import type { CardSetRepository } from '../../ports/CardSetRepository'
import { getDb } from './db'

/**
 * IndexedDB による札セット保存。画像・音声は dataURL 文字列として CardSet 内に埋め込んで保存する
 * （IndexedDB は Blob も扱えるが、JSON エクスポートとの互換性を優先して文字列で統一）。
 */
export class IndexedDbCardSetRepository implements CardSetRepository {
  async list(): Promise<CardSetSummary[]> {
    const db = await getDb()
    const all = await db.getAll('cardSets')
    return all
      .map(toSummary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<CardSet | undefined> {
    const db = await getDb()
    const raw = await db.get('cardSets', id)
    if (!raw) return undefined
    const parsed = CardSetSchema.safeParse(raw)
    return parsed.success ? parsed.data : undefined
  }

  async save(set: CardSet): Promise<void> {
    const db = await getDb()
    await db.put('cardSets', { ...set, updatedAt: new Date().toISOString() })
  }

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('cardSets', id)
  }
}

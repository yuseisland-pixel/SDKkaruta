import type { CardSet, CardSetSummary } from '../domain/card'

/**
 * 札セットの永続化ポート。
 * 現在は IndexedDB 実装。将来オンライン化する際は同じインターフェースの
 * HttpCardSetRepository を adapters/http/ に追加し、app/di.ts で差し替えるだけでよい。
 */
export interface CardSetRepository {
  list(): Promise<CardSetSummary[]>
  get(id: string): Promise<CardSet | undefined>
  save(set: CardSet): Promise<void>
  delete(id: string): Promise<void>
}

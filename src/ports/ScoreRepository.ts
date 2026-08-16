import type { ScoreRecord } from '../domain/score'

/**
 * 成績の永続化ポート。将来はサーバー API 実装（ランキング）に差し替える。
 */
export interface ScoreRepository {
  save(record: ScoreRecord): Promise<void>
  /** 指定セット×ルールの全記録（新しい順） */
  list(cardSetId: string, ruleId: string): Promise<ScoreRecord[]>
  /** ベスト記録（完走したもののみ） */
  getBest(cardSetId: string, ruleId: string): Promise<ScoreRecord | undefined>
  clear(cardSetId?: string): Promise<void>
}

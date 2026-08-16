/**
 * 成績レコード。サーバーへそのまま送信できるフラットな JSON にしておく。
 */
import type { FinishReason } from './engine'

export type ScoreMode = 'solo' | 'pvp' | 'cpu'

export interface ScorePlayer {
  name: string
  taken: number
  misses: number
  cpu?: boolean
}

export interface ScoreRecord {
  id: string
  cardSetId: string
  ruleId: string
  /** ペナルティ込みタイム */
  timeMs: number
  rawTimeMs: number
  misses: number
  takenCount: number
  totalCount: number
  finishReason: FinishReason
  playedAt: string
  voiceId?: string
  /** 省略時は solo */
  mode?: ScoreMode
  /** 対戦時の各プレイヤー成績 */
  players?: ScorePlayer[]
  /** 対戦時の勝者 index（引き分けは null） */
  winnerIndex?: number | null
  /** 将来: サーバー同期状態 */
  synced?: boolean
}

/** ベストタイムの比較対象になるレコードか（ソロで完走したものだけ） */
export function isRankable(r: ScoreRecord): boolean {
  return r.finishReason === 'complete' && (r.mode ?? 'solo') === 'solo'
}

/** サドンデス等では取った枚数→タイムの順で比較したいので、比較関数を分けておく */
export function compareScores(a: ScoreRecord, b: ScoreRecord): number {
  if (a.takenCount !== b.takenCount) return b.takenCount - a.takenCount
  return a.timeMs - b.timeMs
}

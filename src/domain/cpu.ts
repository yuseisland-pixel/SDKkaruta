/**
 * CPU プレイヤーの意思決定（純粋関数）。タイマー実行は UI 側（useCpuPlayer）が担当。
 */
import type { FieldCard } from './engine'

export type CpuLevel = 'easy' | 'normal' | 'hard'

export interface CpuProfile {
  level: CpuLevel
  label: string
  /** 読み札が提示されてから取るまでの反応時間の範囲 (ms) */
  reactionMinMs: number
  reactionMaxMs: number
  /** お手つきする確率 */
  missRate: number
}

export const CPU_PROFILES: Record<CpuLevel, CpuProfile> = {
  easy: { level: 'easy', label: 'やさしい', reactionMinMs: 3500, reactionMaxMs: 6000, missRate: 0.25 },
  normal: { level: 'normal', label: 'ふつう', reactionMinMs: 2200, reactionMaxMs: 3800, missRate: 0.12 },
  hard: { level: 'hard', label: 'つよい', reactionMinMs: 1200, reactionMaxMs: 2200, missRate: 0.05 },
}

export interface CpuMove {
  delayMs: number
  cardId: string
  /** わざと間違える手か */
  isMiss: boolean
}

/**
 * 現在の読み札に対する CPU の一手を決める。
 * 場に取れる札が無ければ null。ミス時は必ず正解以外の残り札を選ぶ（残りが正解のみなら正解を取る）。
 */
export function planCpuMove(
  random: () => number,
  level: CpuLevel,
  field: FieldCard[],
  currentId: string,
): CpuMove | null {
  const prof = CPU_PROFILES[level]
  const remaining = field.filter((f) => !f.taken)
  if (remaining.length === 0) return null
  const delayMs = Math.round(prof.reactionMinMs + random() * (prof.reactionMaxMs - prof.reactionMinMs))
  const wrongs = remaining.filter((f) => f.card.id !== currentId)
  const wantMiss = random() < prof.missRate && wrongs.length > 0
  if (wantMiss) {
    const pick = wrongs[Math.floor(random() * wrongs.length)]
    return { delayMs, cardId: pick.card.id, isMiss: true }
  }
  const correct = remaining.find((f) => f.card.id === currentId)
  if (!correct) return null
  return { delayMs, cardId: correct.card.id, isMiss: false }
}

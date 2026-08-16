/**
 * ゲームルール定義。プリセット 4 種（元サイト相当）＋カスタムルールを同じ型で表現する。
 */
import { z } from 'zod'

export const GameRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  /** 場に出す枚数。'all' なら全札、数値なら先頭からではなくランダムに選ぶ */
  cardCount: z.union([z.literal('all'), z.number().int().positive()]),
  /** 場に出す枚数が全札より少ないときの選び方 */
  pick: z.enum(['random', 'head']).default('random'),
  /** ミス時の挙動 */
  onMiss: z.enum(['penalty', 'gameover', 'ignore']).default('penalty'),
  /** onMiss=penalty のときタイムに加算する秒数 */
  penaltySec: z.number().nonnegative().default(3),
  /** 読み札のテキストを画面に表示するか */
  showYomiText: z.boolean().default(true),
  /** 読み上げモード（プレイヤー操作なし、自動で次へ進む） */
  readOnly: z.boolean().default(false),
  /** 正解（または読み上げ完了）から次の札までの待ち時間 */
  autoNextDelayMs: z.number().nonnegative().default(600),
  /** 場の並びをシャッフルするか */
  shuffleField: z.boolean().default(true),
  /** 読み札の順番をシャッフルするか */
  shuffleReading: z.boolean().default(true),
  /** 場から取った札を消すか（false なら残る） */
  removeTaken: z.boolean().default(true),
  /** 組み込みプリセットなら true（削除不可） */
  builtin: z.boolean().optional(),
})
export type GameRule = z.infer<typeof GameRuleSchema>

export const PRESET_RULES: GameRule[] = [
  {
    id: 'timeattack-all',
    name: '全札タイムアタック',
    description: '全ての札を取り終わるまでのタイムを競います。お手つきは +3 秒。',
    cardCount: 'all',
    pick: 'random',
    onMiss: 'penalty',
    penaltySec: 3,
    showYomiText: true,
    readOnly: false,
    autoNextDelayMs: 600,
    shuffleField: true,
    shuffleReading: true,
    removeTaken: true,
    builtin: true,
  },
  {
    id: 'timeattack-half',
    name: '半分タイムアタック',
    description: 'ランダムに選んだ半分の札で行うタイムアタック。お手つきは +3 秒。',
    cardCount: 'all', // 実際の枚数は resolveCardCount() で半分に解決する
    pick: 'random',
    onMiss: 'penalty',
    penaltySec: 3,
    showYomiText: true,
    readOnly: false,
    autoNextDelayMs: 600,
    shuffleField: true,
    shuffleReading: true,
    removeTaken: true,
    builtin: true,
  },
  {
    id: 'sudden-death',
    name: 'サドンデス',
    description: '1 回でもお手つきしたらそこで終了。何枚取れるか挑戦。',
    cardCount: 'all',
    pick: 'random',
    onMiss: 'gameover',
    penaltySec: 0,
    showYomiText: true,
    readOnly: false,
    autoNextDelayMs: 600,
    shuffleField: true,
    shuffleReading: true,
    removeTaken: true,
    builtin: true,
  },
  {
    id: 'reading-only',
    name: '読み上げモード',
    description: '札は自動で進みます。実物のかるたで遊ぶときの読み手として使えます。',
    cardCount: 'all',
    pick: 'random',
    onMiss: 'ignore',
    penaltySec: 0,
    showYomiText: true,
    readOnly: true,
    autoNextDelayMs: 4000,
    shuffleField: false,
    shuffleReading: true,
    removeTaken: true,
    builtin: true,
  },
]

/** ルールと全札数から実際に場へ出す枚数を決める */
export function resolveCardCount(rule: GameRule, total: number): number {
  if (rule.id === 'timeattack-half') return Math.max(1, Math.ceil(total / 2))
  if (rule.cardCount === 'all') return total
  return Math.max(1, Math.min(rule.cardCount, total))
}

export function createCustomRule(base?: Partial<GameRule>): GameRule {
  return GameRuleSchema.parse({
    id: `rule_${Date.now().toString(36)}`,
    name: 'カスタムルール',
    description: '',
    cardCount: 'all',
    ...base,
    builtin: false,
  })
}

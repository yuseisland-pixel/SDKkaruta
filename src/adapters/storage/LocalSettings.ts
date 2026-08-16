import { z } from 'zod'

export const GameModeSchema = z.enum(['solo', 'pvp', 'cpu'])
export type GameMode = z.infer<typeof GameModeSchema>
export const CpuLevelSchema = z.enum(['easy', 'normal', 'hard'])
export type CpuLevel = z.infer<typeof CpuLevelSchema>

export const AppSettingsSchema = z.object({
  /** 使う SpeechProvider の ID（'auto' なら Composite の優先順） */
  speechProviderId: z.string().default('auto'),
  /** 選択中の声 ID */
  voiceId: z.string().optional(),
  rate: z.number().positive().default(1),
  /** 最後に選んだ札セット/ルール */
  lastCardSetId: z.string().optional(),
  lastRuleId: z.string().optional(),
  playerName: z.string().default(''),
  /** 対戦設定 */
  mode: GameModeSchema.default('solo'),
  cpuLevel: CpuLevelSchema.default('normal'),
  p1Name: z.string().default('プレイヤー1'),
  p2Name: z.string().default('プレイヤー2'),
  /** 2人対戦で上段を 180° 回転して対面表示 */
  faceToFace: z.boolean().default(false),
})
export type AppSettings = z.infer<typeof AppSettingsSchema>

const KEY = 'sdkkaruta.settings'

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return AppSettingsSchema.parse(raw ? JSON.parse(raw) : {})
  } catch {
    return AppSettingsSchema.parse({})
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

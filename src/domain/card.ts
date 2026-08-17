/**
 * 札（カード）と札セットのドメインモデル。
 * React / ブラウザ API に依存しない純粋な型と関数のみを置く（サーバー側にもそのまま移植可能）。
 */
import { z } from 'zod'

/** 画像・音声の参照。dataURL / Blob URL / http(s) URL / 相対パスのいずれか */
export type AssetRef = string

/** 絵札に重ねる頭文字バッジ（丸＋文字）の表示設定 */
export const KanaBadgeSchema = z.object({
  show: z.boolean().default(true),
  /** バッジ中心の X 位置（札幅比 0–1） */
  x: z.number().min(0).max(1).default(0.16),
  /** バッジ中心の Y 位置（札高さ比 0–1） */
  y: z.number().min(0).max(1).default(0.12),
  /** バッジ半径（札幅比） */
  size: z.number().min(0.05).max(0.5).default(0.13),
})
export type KanaBadge = z.infer<typeof KanaBadgeSchema>
export const DEFAULT_KANA_BADGE: KanaBadge = KanaBadgeSchema.parse({})

export const CardSchema = z.object({
  id: z.string().min(1),
  /** 並び順（0 始まり） */
  order: z.number().int().nonnegative(),
  /** 頭文字（決まり字）。絵札に大きく表示される文字 */
  kana: z.string().min(1),
  /** 読み札の本文 */
  yomi: z.string().min(1),
  /** 読み上げ用のかな表記（未指定なら yomi を読み上げる） */
  yomiKana: z.string().optional(),
  /** 絵札画像 */
  efudaImage: z.string().optional(),
  /** 読み札画像 */
  yomifudaImage: z.string().optional(),
  /** 読み上げ音声（登録済みなら音声合成より優先） */
  audio: z.string().optional(),
  /** 自由メタデータ（解説文・出典など） */
  meta: z.record(z.string(), z.string()).optional(),
  /** 頭文字バッジ設定（未設定ならデフォルト位置に表示） */
  kanaBadge: KanaBadgeSchema.optional(),
})
export type Card = z.infer<typeof CardSchema>

/** 札のバッジ設定（未設定ならデフォルト） */
export function badgeOf(card: Card): KanaBadge {
  return card.kanaBadge ?? DEFAULT_KANA_BADGE
}

export const VoiceConfigSchema = z.object({
  /** 読み上げ速度（1.0 が標準） */
  rate: z.number().positive().optional(),
})
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>

export const CARD_SET_FORMAT_VERSION = 1

export const CardSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  /** データ形式のバージョン（将来のマイグレーション用） */
  version: z.number().int().default(CARD_SET_FORMAT_VERSION),
  createdAt: z.string(),
  updatedAt: z.string(),
  cards: z.array(CardSchema),
  voiceConfig: VoiceConfigSchema.optional(),
  /** 同梱サンプルなど、編集不可にしたい場合 true */
  readonly: z.boolean().optional(),
})
export type CardSet = z.infer<typeof CardSetSchema>

/** 一覧表示用の軽量サマリ（画像を含まない） */
export interface CardSetSummary {
  id: string
  name: string
  description: string
  cardCount: number
  updatedAt: string
  readonly?: boolean
  /** 先頭数枚のプレビュー（絵札画像 or 頭文字） */
  thumbnails: { kana: string; image?: string }[]
}

export const SUMMARY_THUMBNAIL_COUNT = 4

export function toSummary(set: CardSet): CardSetSummary {
  const head = [...set.cards].sort((a, b) => a.order - b.order).slice(0, SUMMARY_THUMBNAIL_COUNT)
  return {
    id: set.id,
    name: set.name,
    description: set.description,
    cardCount: set.cards.length,
    updatedAt: set.updatedAt,
    readonly: set.readonly,
    thumbnails: head.map((c) => ({ kana: c.kana, image: c.efudaImage })),
  }
}

export function newId(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${rnd}`
}

export function createEmptyCard(order: number): Card {
  return { id: newId('card'), order, kana: '', yomi: '' }
}

export function createEmptyCardSet(name = '新しいかるた'): CardSet {
  const now = new Date().toISOString()
  return {
    id: newId('set'),
    name,
    description: '',
    version: CARD_SET_FORMAT_VERSION,
    createdAt: now,
    updatedAt: now,
    cards: [],
  }
}

/** order を 0..n-1 に振り直した新しい配列を返す */
export function normalizeOrder(cards: Card[]): Card[] {
  return [...cards]
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ ...c, order: i }))
}

/** 札セットのバリデーション。問題があればメッセージ配列を返す（空なら OK） */
export function validateCardSet(set: CardSet): string[] {
  const errors: string[] = []
  if (!set.name.trim()) errors.push('セット名を入力してください')
  if (set.cards.length === 0) errors.push('札が 1 枚もありません')
  const seenKana = new Map<string, number>()
  set.cards.forEach((c, i) => {
    const n = i + 1
    if (!c.kana.trim()) errors.push(`${n} 枚目: 頭文字が空です`)
    if (!c.yomi.trim()) errors.push(`${n} 枚目: 読み札の文が空です`)
    if (c.kana.trim()) {
      const prev = seenKana.get(c.kana)
      if (prev !== undefined) errors.push(`${n} 枚目: 頭文字「${c.kana}」が ${prev} 枚目と重複しています`)
      else seenKana.set(c.kana, n)
    }
  })
  return errors
}

/** 読み上げに使う文字列を決定する */
export function readingTextOf(card: Card): string {
  return (card.yomiKana && card.yomiKana.trim()) || card.yomi
}

/**
 * ダミー/サンプル札セットの生成。動作確認・テンプレート用途。
 */
import type { Card, CardSet } from '../domain/card'
import { createEmptyCardSet, newId } from '../domain/card'
import { renderEfuda, renderYomifuda } from './renderCard'

/** 上毛かるた・いろはかるたと同じ 44〜46 音の並び */
export const GOJUON_KEYS = [
  'あ', 'い', 'う', 'え', 'お',
  'か', 'き', 'く', 'け', 'こ',
  'さ', 'し', 'す', 'せ', 'そ',
  'た', 'ち', 'つ', 'て', 'と',
  'な', 'に', 'ぬ', 'ね', 'の',
  'は', 'ひ', 'ふ', 'へ', 'ほ',
  'ま', 'み', 'む', 'め', 'も',
  'や', 'ゆ', 'よ',
  'ら', 'り', 'る', 'れ', 'ろ',
  'わ', 'を', 'ん',
]

const SAMPLE_EMBLEMS = [
  '🌸', '🍁', '⛰️', '🌊', '🍙', '🎋', '🏯', '🐟', '🍵', '🎐',
  '🌙', '🦋', '🍡', '🎏', '🐢', '🌾', '⛩️', '🍊', '🎎', '🐇',
  '🌻', '🍇', '🚂', '🐦', '🎑', '🍄', '🎍', '🐸', '🌈', '🍑',
  '🦊', '🎆', '🐝', '🍜', '🌷', '🎈', '🐬', '🍋', '🎨', '🐈',
  '🌵', '🍰', '🚲', '🐧', '🎵', '🍎',
]

export interface DummyOptions {
  count?: number
  name?: string
  /** 画像を生成する（false なら文字データのみ） */
  withImages?: boolean
  /** 各札の読み文を作る関数（省略時は定型文） */
  yomiOf?: (kana: string, index: number) => string
}

export function defaultDummyYomi(kana: string, index: number): string {
  return `${kana}から始まる ${index + 1} 番目の札です`
}

/** 文字データだけのダミー札セット（同期） */
export function createDummyCardSetData(opts: DummyOptions = {}): CardSet {
  const count = Math.max(1, Math.min(opts.count ?? 44, GOJUON_KEYS.length))
  const set = createEmptyCardSet(opts.name ?? `ダミーかるた（${count}枚）`)
  set.description = '自動生成されたサンプルです。エディタで自由に書き換えてください。'
  const yomiOf = opts.yomiOf ?? defaultDummyYomi
  set.cards = GOJUON_KEYS.slice(0, count).map<Card>((kana, i) => ({
    id: newId('card'),
    order: i,
    kana,
    yomi: yomiOf(kana, i),
    meta: { emblem: SAMPLE_EMBLEMS[i % SAMPLE_EMBLEMS.length] },
  }))
  return set
}

/** 画像付きダミー札セット（Canvas 生成のため非同期） */
export async function createDummyCardSet(opts: DummyOptions = {}): Promise<CardSet> {
  const set = createDummyCardSetData(opts)
  if (opts.withImages === false) return set
  await fillMissingImages(set)
  return set
}

/**
 * 画像未設定の札に対してのみ自動生成画像を埋める（既存の自作画像は上書きしない）。
 * `onProgress` で進捗を通知。
 */
export async function fillMissingImages(
  set: CardSet,
  onProgress?: (done: number, total: number) => void,
  force = false,
): Promise<CardSet> {
  const total = set.cards.length
  for (let i = 0; i < total; i++) {
    const c = set.cards[i]
    if (force || !c.efudaImage) {
      c.efudaImage = await renderEfuda(c, { emblem: c.meta?.emblem })
    }
    if (force || !c.yomifudaImage) {
      c.yomifudaImage = await renderYomifuda(c)
    }
    onProgress?.(i + 1, total)
  }
  return set
}

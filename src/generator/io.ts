/**
 * 札セットのインポート/エクスポート。
 * - JSON: 画像・音声を dataURL で埋め込んだ単一ファイル（バックアップ・共有用）
 * - ZIP: JSON + 画像/音声を個別ファイルにした構成（手作業で画像差し替えしやすい）
 * - PNG ZIP: 絵札/読み札の PNG だけを一括出力（印刷用）
 */
import JSZip from 'jszip'
import type { Card, CardSet } from '../domain/card'
import { CardSchema, CardSetSchema, newId, normalizeOrder } from '../domain/card'
import { blobToDataUrl } from './renderCard'

// ===== 札 1 枚単位 =====

/** 札 1 枚を JSON 化（画像・音声は dataURL のまま埋め込む） */
export function exportCardJson(card: Card): string {
  return JSON.stringify({ format: 'sdkkaruta-card', version: 1, card }, null, 2)
}

/** exportCardJson の逆。ID は振り直し、order は呼び出し側で決める */
export function importCardJson(json: string): Card {
  const raw = JSON.parse(json)
  const candidate = raw && typeof raw === 'object' && 'card' in raw ? raw.card : raw
  const parsed = CardSchema.safeParse(candidate)
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ')
    throw new Error(`札の形式が正しくありません: ${msg}`)
  }
  return { ...parsed.data, id: newId('card') }
}

/** dataURL をそのままファイルとしてダウンロード */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const { blob } = dataUrlToBlob(dataUrl)
  downloadBlob(blob, filename)
}

/** 札のファイル名ベース（例: 001_あ） */
export function cardFileBase(card: Card, index: number): string {
  return `${String(index + 1).padStart(3, '0')}_${safeFilename(card.kana || 'card')}`
}

// ===== 札セット =====

export function exportCardSetJson(set: CardSet): string {
  return JSON.stringify(set, null, 2)
}

export interface ImportOptions {
  /** ID を振り直して別セットとして取り込む（同 ID の上書きを避ける） */
  regenerateIds?: boolean
}

export function importCardSetJson(json: string, opts: ImportOptions = {}): CardSet {
  const raw = JSON.parse(json)
  const parsed = CardSetSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ')
    throw new Error(`札セットの形式が正しくありません: ${msg}`)
  }
  let set = parsed.data
  set = { ...set, cards: normalizeOrder(set.cards), readonly: false }
  if (opts.regenerateIds) {
    set = {
      ...set,
      id: newId('set'),
      cards: set.cards.map((c) => ({ ...c, id: newId('card') })),
    }
  }
  return set
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [head, b64] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg').replace('mpeg', 'mp3') ?? 'bin'
  return { blob: new Blob([bytes], { type: mime }), ext }
}

/** アセットをファイル分離した ZIP を作る */
export async function exportCardSetZip(set: CardSet): Promise<Blob> {
  const zip = new JSZip()
  const copy: CardSet = { ...set, cards: set.cards.map((c) => ({ ...c })) }
  const put = (folder: string, base: string, dataUrl?: string): string | undefined => {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl
    const { blob, ext } = dataUrlToBlob(dataUrl)
    const path = `${folder}/${base}.${ext}`
    zip.file(path, blob)
    return path
  }
  copy.cards.forEach((c, i) => {
    const base = `${String(i + 1).padStart(3, '0')}_${c.kana}`
    c.efudaImage = put('efuda', base, c.efudaImage)
    c.yomifudaImage = put('yomifuda', base, c.yomifudaImage)
    c.audio = put('audio', base, c.audio)
  })
  zip.file('cardset.json', JSON.stringify(copy, null, 2))
  return zip.generateAsync({ type: 'blob' })
}

/** exportCardSetZip の逆。相対パスのアセットを dataURL に戻す */
export async function importCardSetZip(file: Blob, opts: ImportOptions = {}): Promise<CardSet> {
  const zip = await JSZip.loadAsync(file)
  const jsonFile = zip.file('cardset.json')
  if (!jsonFile) throw new Error('cardset.json が ZIP 内にありません')
  const set = importCardSetJson(await jsonFile.async('string'), opts)
  const resolve = async (p?: string): Promise<string | undefined> => {
    if (!p || p.startsWith('data:') || /^https?:/.test(p)) return p
    const f = zip.file(p)
    if (!f) return undefined
    return blobToDataUrl(await f.async('blob'))
  }
  for (const c of set.cards) {
    c.efudaImage = await resolve(c.efudaImage)
    c.yomifudaImage = await resolve(c.yomifudaImage)
    c.audio = await resolve(c.audio)
  }
  return set
}

/** 印刷用 PNG 一括 ZIP */
export async function exportImagesZip(set: CardSet): Promise<Blob> {
  const zip = new JSZip()
  set.cards.forEach((c, i) => {
    const base = `${String(i + 1).padStart(3, '0')}_${c.kana}`
    if (c.efudaImage?.startsWith('data:')) zip.file(`efuda/${base}.png`, dataUrlToBlob(c.efudaImage).blob)
    if (c.yomifudaImage?.startsWith('data:')) zip.file(`yomifuda/${base}.png`, dataUrlToBlob(c.yomifudaImage).blob)
  })
  return zip.generateAsync({ type: 'blob' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'karuta'
}

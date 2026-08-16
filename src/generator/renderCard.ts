/**
 * Canvas を使った札画像の自動生成。
 * 自作画像を用意しないカード（ダミー・サンプル・プレースホルダー）に使う。
 */
import type { Card } from '../domain/card'

export interface CardStyle {
  width: number
  height: number
  background: string
  border: string
  textColor: string
  accent: string
  fontFamily: string
}

export const DEFAULT_CARD_STYLE: CardStyle = {
  width: 360,
  height: 520,
  background: '#fdf6e3',
  border: '#8b5a2b',
  textColor: '#222',
  accent: '#c0392b',
  fontFamily:
    '"Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif',
}

/** 頭文字ごとに安定した色を割り当てる（ダミー絵札の見分けを付けやすくする） */
export function colorForKey(key: string): string {
  let h = 0
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) % 360
  return `hsl(${h}, 55%, 78%)`
}

function createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  return new OffscreenCanvas(w, h)
}

async function toDataUrl(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<string> {
  if ('toDataURL' in canvas) return canvas.toDataURL('image/png')
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return blobToDataUrl(blob)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 文字列を最大幅に収まるように折り返す（日本語は 1 文字単位） */
export function wrapText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  for (const para of text.split(/\r?\n/)) {
    let line = ''
    for (const ch of para) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    lines.push(line)
  }
  return lines
}

export interface EfudaOptions {
  style?: Partial<CardStyle>
  /** 中央に大きく描く絵文字や短い語（未指定なら頭文字を大きく描く） */
  emblem?: string
  /** 背景色（未指定なら頭文字から自動） */
  background?: string
}

/** 絵札を生成して PNG dataURL を返す */
export async function renderEfuda(card: Card, opts: EfudaOptions = {}): Promise<string> {
  const st = { ...DEFAULT_CARD_STYLE, ...opts.style }
  const canvas = createCanvas(st.width, st.height)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const bg = opts.background ?? colorForKey(card.kana)

  // 背景
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, st.width, st.height)
  // 枠
  ctx.lineWidth = 12
  ctx.strokeStyle = st.border
  roundRect(ctx, 6, 6, st.width - 12, st.height - 12, 18)
  ctx.stroke()
  ctx.lineWidth = 2
  roundRect(ctx, 22, 22, st.width - 44, st.height - 44, 12)
  ctx.stroke()

  // 頭文字（左上の丸）
  const r = st.width * 0.13
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(40 + r, 40 + r, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = st.accent
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.fillStyle = st.accent
  ctx.font = `bold ${Math.floor(r * 1.3)}px ${st.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(card.kana, 40 + r, 40 + r + 2)

  // 中央エンブレム
  const emblem = opts.emblem ?? card.kana
  ctx.fillStyle = st.textColor
  ctx.font = `bold ${Math.floor(st.width * (emblem.length > 2 ? 0.22 : 0.5))}px ${st.fontFamily}`
  ctx.fillText(emblem, st.width / 2, st.height * 0.56)

  // 下部に読み札の先頭語（うっすら）
  ctx.font = `${Math.floor(st.width * 0.055)}px ${st.fontFamily}`
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  const head = card.yomi.length > 12 ? card.yomi.slice(0, 12) + '…' : card.yomi
  ctx.fillText(head, st.width / 2, st.height * 0.88)

  return toDataUrl(canvas)
}

export interface YomifudaOptions {
  style?: Partial<CardStyle>
  /** 縦書き風（1 行 1 文字ずつ縦に並べる） */
  vertical?: boolean
}

/** 読み札を生成して PNG dataURL を返す */
export async function renderYomifuda(card: Card, opts: YomifudaOptions = {}): Promise<string> {
  const st = { ...DEFAULT_CARD_STYLE, ...opts.style }
  const canvas = createCanvas(st.width, st.height)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

  ctx.fillStyle = st.background
  ctx.fillRect(0, 0, st.width, st.height)
  ctx.lineWidth = 12
  ctx.strokeStyle = st.border
  roundRect(ctx, 6, 6, st.width - 12, st.height - 12, 18)
  ctx.stroke()

  ctx.fillStyle = st.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (opts.vertical) {
    // 縦書き: 右から左へ列を並べる
    const fontSize = Math.floor(st.width * 0.11)
    ctx.font = `${fontSize}px ${st.fontFamily}`
    const maxPerCol = Math.floor((st.height - 100) / (fontSize * 1.1))
    const cols: string[] = []
    for (const para of card.yomi.split(/\r?\n/)) {
      for (let i = 0; i < para.length; i += maxPerCol) cols.push(para.slice(i, i + maxPerCol))
    }
    const colW = fontSize * 1.4
    const startX = st.width / 2 + ((cols.length - 1) * colW) / 2
    cols.forEach((col, ci) => {
      const x = startX - ci * colW
      Array.from(col).forEach((ch, i) => {
        ctx.fillText(ch, x, 60 + fontSize * 0.6 + i * fontSize * 1.1)
      })
    })
  } else {
    let fontSize = Math.floor(st.width * 0.1)
    let lines: string[] = []
    // 収まるまでフォントを小さくする
    for (; fontSize >= 16; fontSize -= 2) {
      ctx.font = `${fontSize}px ${st.fontFamily}`
      lines = wrapText(ctx, card.yomi, st.width - 80)
      if (lines.length * fontSize * 1.4 < st.height - 120) break
    }
    const lineH = fontSize * 1.4
    const startY = st.height / 2 - ((lines.length - 1) * lineH) / 2
    lines.forEach((l, i) => ctx.fillText(l, st.width / 2, startY + i * lineH))
  }

  // 頭文字を小さく右上に
  ctx.font = `bold ${Math.floor(st.width * 0.09)}px ${st.fontFamily}`
  ctx.fillStyle = st.accent
  ctx.fillText(card.kana, st.width - 50, 50)

  return toDataUrl(canvas)
}

/** 画像ファイルを最大辺 maxSize に縮小して dataURL 化する（アップロード用） */
export async function fileToResizedDataUrl(file: File | Blob, maxSize = 800): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  if ('toDataURL' in canvas) return canvas.toDataURL(mime, 0.9)
  return blobToDataUrl(await canvas.convertToBlob({ type: mime, quality: 0.9 }))
}

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Card } from '../../domain/card'
import { badgeOf } from '../../domain/card'

interface Props {
  card: Card
  /** ドラッグ可能にする（エディタ用）。位置変更時に 0-1 の座標を返す */
  onDrag?: (x: number, y: number) => void
}

/**
 * 絵札に重ねる頭文字バッジ。親要素は position:relative（札と同じアスペクト比）であること。
 * 位置・大きさは % 指定なので親のサイズに追従する。
 */
export function KanaBadgeOverlay({ card, onDrag }: Props) {
  const badge = badgeOf(card)
  if (!badge.show || !card.kana) return null

  // 直径 = 札幅の size*2。% の height は親の高さ基準なのでアスペクト比 9:13 を係数で補正
  const dW = badge.size * 2 * 100
  const dH = badge.size * 2 * (9 / 13) * 100
  const style: CSSProperties = {
    left: `${badge.x * 100}%`,
    top: `${badge.y * 100}%`,
    width: `${dW}%`,
    height: `${dH}%`,
    cursor: onDrag ? 'grab' : undefined,
    touchAction: onDrag ? 'none' : undefined,
    pointerEvents: onDrag ? 'auto' : 'none',
  }

  const handleDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!onDrag) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    const parent = el.parentElement
    if (!parent) return
    el.setPointerCapture(e.pointerId)
    const rect = parent.getBoundingClientRect()
    const move = (ev: globalThis.PointerEvent) => {
      const x = Math.min(0.98, Math.max(0.02, (ev.clientX - rect.left) / rect.width))
      const y = Math.min(0.98, Math.max(0.02, (ev.clientY - rect.top) / rect.height))
      onDrag(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000)
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <span
      className={`kana-badge ${onDrag ? 'draggable' : ''}`}
      style={style}
      onPointerDown={handleDown}
      data-testid="kana-badge"
    >
      <span>{card.kana}</span>
    </span>
  )
}

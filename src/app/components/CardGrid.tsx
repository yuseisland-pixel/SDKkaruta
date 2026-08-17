import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldCard } from '../../domain/engine'
import type { GameFeedback } from '../hooks/useGame'
import { KanaBadgeOverlay } from './KanaBadge'

interface Props {
  field: FieldCard[]
  onPick: (cardId: string) => void
  /** 取った札を薄く残すか */
  keepTaken?: boolean
  flash?: GameFeedback | null
  /** flash を表示する対象プレイヤー（未指定なら全員分） */
  flashFor?: number
  disabled?: boolean
  className?: string
}

const CARD_ASPECT = 9 / 13 // w/h

/** 場の絵札グリッド。コンテナサイズに合わせて最も大きく札を表示できる列数を選ぶ */
export function CardGrid({ field, onPick, keepTaken, flash, flashFor, disabled, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 500 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cols = useMemo(() => {
    const n = Math.max(1, field.length)
    let best = 1
    let bestSize = 0
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c)
      const cellW = size.w / c
      const cellH = size.h / r
      const cardH = Math.min(cellH, cellW / CARD_ASPECT)
      if (cardH > bestSize) {
        bestSize = cardH
        best = c
      }
    }
    return best
  }, [field.length, size])

  const activeFlash = flash && (flashFor === undefined || flash.playerIndex === flashFor) ? flash : null

  return (
    <div
      ref={ref}
      className={`field ${className ?? ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {field.map((f) => {
        const cls = ['field-card']
        if (f.taken) cls.push('taken')
        if (f.taken && keepTaken) cls.push('keep')
        if (activeFlash && activeFlash.cardId === f.card.id) {
          const who = activeFlash.playerIndex === 1 ? 'p2' : 'p1'
          cls.push(`flash-${activeFlash.type}`, `flash-${who}`)
        }
        return (
          <button
            key={`${f.card.id}-${activeFlash?.cardId === f.card.id ? activeFlash.key : ''}`}
            className={cls.join(' ')}
            onClick={() => onPick(f.card.id)}
            disabled={disabled || f.taken}
            aria-label={f.card.kana}
          >
            {f.card.efudaImage ? (
              <>
                <img src={f.card.efudaImage} alt={f.card.kana} draggable={false} />
                <KanaBadgeOverlay card={f.card} />
              </>
            ) : (
              <span className="placeholder">{f.card.kana}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

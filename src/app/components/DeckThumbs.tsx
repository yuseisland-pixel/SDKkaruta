import type { CardSetSummary } from '../../domain/card'

/** デッキ選択用の小さなサムネ列（先頭数枚の絵札。画像が無ければ頭文字） */
export function DeckThumbs({ thumbnails, size = 44 }: { thumbnails: CardSetSummary['thumbnails']; size?: number }) {
  if (thumbnails.length === 0) return <div className="deck-thumbs empty small muted">（札なし）</div>
  return (
    <div className="deck-thumbs" style={{ height: size }}>
      {thumbnails.map((t, i) =>
        t.image ? (
          <img key={i} src={t.image} alt={t.kana} title={t.kana} draggable={false} />
        ) : (
          <span key={i} className="thumb-kana" title={t.kana}>
            {t.kana || '?'}
          </span>
        ),
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import type { Card } from '../../domain/card'
import { useServices, useSettings } from '../ServicesContext'
import { readingTextOf } from '../../domain/card'

interface Props {
  card: Card
  index: number
  total: number
  onChange: (patch: Partial<Card>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onGenerateImage: (which: 'efuda' | 'yomifuda' | 'both') => void
  onUploadImage: (which: 'efuda' | 'yomifuda', file: File) => void
  onUploadAudio: (file: File) => void
  onExport: (what: 'efuda' | 'yomifuda' | 'json') => void
  busy?: boolean
}

export function CardForm(p: Props) {
  const { card } = p
  const { speech } = useServices()
  const { settings } = useSettings()
  const efudaRef = useRef<HTMLInputElement>(null)
  const yomiRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const [testing, setTesting] = useState(false)

  const testSpeak = async () => {
    setTesting(true)
    try {
      // CardSet はテキストのみ使うので最小オブジェクトで十分
      await speech.speak(
        card,
        { id: '', name: '', description: '', version: 1, createdAt: '', updatedAt: '', cards: [] },
        { voiceId: settings.voiceId, rate: settings.rate },
      )
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.6em' }}>
        <h2 style={{ margin: 0 }}>
          札 {p.index + 1} / {p.total}
        </h2>
        <div className="row">
          <button className="btn small" onClick={() => p.onMove(-1)} disabled={p.index === 0}>
            ↑
          </button>
          <button className="btn small" onClick={() => p.onMove(1)} disabled={p.index >= p.total - 1}>
            ↓
          </button>
          <button className="btn small danger" onClick={p.onDelete}>
            削除
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '6em 1fr', gap: '0.6rem' }}>
        <label className="field">
          <span>頭文字</span>
          <input
            type="text"
            value={card.kana}
            maxLength={4}
            onChange={(e) => p.onChange({ kana: e.target.value })}
            style={{ fontSize: '1.4em', textAlign: 'center' }}
          />
        </label>
        <label className="field">
          <span>読み札の文</span>
          <textarea value={card.yomi} onChange={(e) => p.onChange({ yomi: e.target.value })} rows={2} />
        </label>
      </div>
      <div className="grid cols-2">
        <label className="field">
          <span>読み上げ用よみがな（任意・漢字の誤読対策）</span>
          <input
            type="text"
            value={card.yomiKana ?? ''}
            placeholder={card.yomi}
            onChange={(e) => p.onChange({ yomiKana: e.target.value || undefined })}
          />
        </label>
        <label className="field">
          <span>自動生成絵札のエンブレム（絵文字・短い語）</span>
          <input
            type="text"
            value={card.meta?.emblem ?? ''}
            placeholder="例: 🌸"
            onChange={(e) => p.onChange({ meta: { ...card.meta, emblem: e.target.value } })}
          />
        </label>
      </div>
      <label className="field">
        <span>メモ・解説（任意）</span>
        <textarea
          value={card.meta?.note ?? ''}
          onChange={(e) => p.onChange({ meta: { ...card.meta, note: e.target.value } })}
          rows={2}
        />
      </label>

      <h3>画像</h3>
      <div className="preview-pair">
        <div>
          <div className="small muted">絵札（場に並ぶ）</div>
          {card.efudaImage ? (
            <img src={card.efudaImage} alt="絵札" />
          ) : (
            <div className="noimg" style={{ aspectRatio: '9/13' }}>
              未設定
            </div>
          )}
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn small" onClick={() => efudaRef.current?.click()}>
              📁 画像を選ぶ
            </button>
            <button className="btn small" onClick={() => p.onGenerateImage('efuda')} disabled={p.busy}>
              🎨 自動生成
            </button>
            {card.efudaImage && (
              <button className="btn small" onClick={() => p.onChange({ efudaImage: undefined })}>
                ✕
              </button>
            )}
          </div>
          <input
            ref={efudaRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && p.onUploadImage('efuda', e.target.files[0])}
          />
        </div>
        <div>
          <div className="small muted">読み札（印刷・表示用）</div>
          {card.yomifudaImage ? (
            <img src={card.yomifudaImage} alt="読み札" />
          ) : (
            <div className="noimg" style={{ aspectRatio: '9/13' }}>
              未設定
            </div>
          )}
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn small" onClick={() => yomiRef.current?.click()}>
              📁 画像を選ぶ
            </button>
            <button className="btn small" onClick={() => p.onGenerateImage('yomifuda')} disabled={p.busy}>
              🎨 自動生成
            </button>
            {card.yomifudaImage && (
              <button className="btn small" onClick={() => p.onChange({ yomifudaImage: undefined })}>
                ✕
              </button>
            )}
          </div>
          <input
            ref={yomiRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && p.onUploadImage('yomifuda', e.target.files[0])}
          />
        </div>
      </div>

      <h3 style={{ marginTop: '1em' }}>音声</h3>
      <div className="row">
        {card.audio ? (
          <>
            <audio controls src={card.audio} style={{ height: 32 }} />
            <button className="btn small" onClick={() => p.onChange({ audio: undefined })}>
              ✕ 音声を外す
            </button>
          </>
        ) : (
          <span className="small muted">未登録（合成音声で読み上げます）</span>
        )}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" onClick={() => audioRef.current?.click()}>
          📁 音声ファイルを選ぶ
        </button>
        <button className="btn small" onClick={() => void testSpeak()} disabled={testing}>
          ▶ 試聴（現在の設定で）
        </button>
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => e.target.files?.[0] && p.onUploadAudio(e.target.files[0])}
        />
      </div>
      <p className="small muted" style={{ marginTop: 4 }}>
        読み上げテキスト: 「{readingTextOf(card) || '…'}」
      </p>

      <h3 style={{ marginTop: '1em' }}>この札を書き出す</h3>
      <div className="row">
        <button className="btn small" onClick={() => p.onExport('efuda')} disabled={!card.efudaImage}>
          🖼 絵札 PNG
        </button>
        <button className="btn small" onClick={() => p.onExport('yomifuda')} disabled={!card.yomifudaImage}>
          🖼 読み札 PNG
        </button>
        <button className="btn small" onClick={() => p.onExport('json')}>
          📄 札 JSON
        </button>
        <span className="small muted">（札 JSON は他のセットの「📥 札 JSON」で取り込めます）</span>
      </div>
    </div>
  )
}

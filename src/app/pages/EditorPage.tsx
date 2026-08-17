import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCardSet } from '../hooks/useCardSets'
import { useServices } from '../ServicesContext'
import type { Card, CardSet, KanaBadge } from '../../domain/card'
import { createEmptyCard, normalizeOrder, validateCardSet } from '../../domain/card'
import {
  renderEfuda,
  renderYomifuda,
  composeEfudaPng,
  fileToResizedDataUrl,
  blobToDataUrl,
} from '../../generator/renderCard'
import { fillMissingImages } from '../../generator/dummy'
import {
  exportCardSetJson,
  exportCardSetZip,
  exportImagesZip,
  exportCardJson,
  importCardJson,
  downloadBlob,
  downloadDataUrl,
  cardFileBase,
  safeFilename,
} from '../../generator/io'
import { GOJUON_KEYS } from '../../generator/dummy'
import { CardForm } from '../components/CardForm'

export function EditorPage() {
  const { setId } = useParams()
  const { set: loaded, loading } = useCardSet(setId)
  const { cardSets } = useServices()
  const [set, setSet] = useState<CardSet | undefined>()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cardFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loaded) {
      setSet(loaded)
      setSelectedId(loaded.cards[0]?.id ?? null)
    }
  }, [loaded])

  // 未保存の離脱警告
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const update = useCallback((fn: (s: CardSet) => CardSet) => {
    setSet((prev) => (prev ? fn(prev) : prev))
    setDirty(true)
  }, [])

  const updateCard = useCallback(
    (id: string, patch: Partial<Card>) =>
      update((s) => ({ ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    [update],
  )

  const save = useCallback(async () => {
    if (!set) return
    setBusy('保存中')
    try {
      const normalized = { ...set, cards: normalizeOrder(set.cards) }
      await cardSets.save(normalized)
      setSet({ ...normalized, updatedAt: new Date().toISOString() })
      setDirty(false)
      setMessage('保存しました')
      setTimeout(() => setMessage(null), 2000)
    } finally {
      setBusy(null)
    }
  }, [set, cardSets])

  // Ctrl+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [save])

  const errors = useMemo(() => (set ? validateCardSet(set) : []), [set])
  const orderedCards = useMemo(() => (set ? normalizeOrder(set.cards) : []), [set])
  const selected = set?.cards.find((c) => c.id === selectedId) ?? null
  const selectedIndex = orderedCards.findIndex((c) => c.id === selectedId)

  if (loading) return <p className="muted">読み込み中…</p>
  if (!set)
    return (
      <div>
        <p className="error">札セットが見つかりません。</p>
        <Link className="btn" to="/editor">
          一覧へ
        </Link>
      </div>
    )

  // ---- 札操作 ----
  const addCard = () => {
    const used = new Set(set.cards.map((c) => c.kana))
    const nextKana = GOJUON_KEYS.find((k) => !used.has(k)) ?? ''
    const card = { ...createEmptyCard(set.cards.length), kana: nextKana }
    update((s) => ({ ...s, cards: [...s.cards, card] }))
    setSelectedId(card.id)
  }
  const removeCard = (id: string) => {
    if (!confirm('この札を削除しますか？')) return
    update((s) => ({ ...s, cards: normalizeOrder(s.cards.filter((c) => c.id !== id)) }))
    setSelectedId((cur) => (cur === id ? null : cur))
  }
  const moveCard = (id: string, dir: -1 | 1) => {
    update((s) => {
      const cards = normalizeOrder(s.cards)
      const i = cards.findIndex((c) => c.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= cards.length) return s
      ;[cards[i], cards[j]] = [cards[j], cards[i]]
      return { ...s, cards: normalizeOrder(cards.map((c, k) => ({ ...c, order: k }))) }
    })
  }
  const importCardFile = async (file: File) => {
    setError(null)
    try {
      const card = importCardJson(await file.text())
      card.order = set.cards.length
      update((s) => ({ ...s, cards: [...s.cards, card] }))
      setSelectedId(card.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (cardFileRef.current) cardFileRef.current.value = ''
    }
  }

  // ---- 画像 ----
  const genImagesFor = async (card: Card, which: 'efuda' | 'yomifuda' | 'both') => {
    const patch: Partial<Card> = {}
    if (which !== 'yomifuda') patch.efudaImage = await renderEfuda(card, { emblem: card.meta?.emblem })
    if (which !== 'efuda') patch.yomifudaImage = await renderYomifuda(card)
    updateCard(card.id, patch)
  }
  const genAllImages = async (force: boolean) => {
    if (force && !confirm('全ての札の画像を自動生成で上書きします。よろしいですか？')) return
    setBusy('画像生成中')
    try {
      const copy: CardSet = { ...set, cards: set.cards.map((c) => ({ ...c })) }
      await fillMissingImages(copy, (d, t) => setProgress([d, t]), force)
      update(() => copy)
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }
  const uploadImage = async (card: Card, which: 'efuda' | 'yomifuda', file: File) => {
    const dataUrl = await fileToResizedDataUrl(file, 900)
    updateCard(card.id, which === 'efuda' ? { efudaImage: dataUrl } : { yomifudaImage: dataUrl })
  }

  // ---- 音声 ----
  const uploadAudio = async (card: Card, file: File) => {
    updateCard(card.id, { audio: await blobToDataUrl(file) })
  }

  // ---- バッジ一括適用 ----
  const applyBadgeToAll = (badge: KanaBadge) => {
    if (!confirm('現在の札のバッジ設定（表示・位置・大きさ）を全ての札に適用しますか？')) return
    update((s) => ({ ...s, cards: s.cards.map((c) => ({ ...c, kanaBadge: { ...badge } })) }))
  }

  // ---- エクスポート ----
  const base = safeFilename(set.name)
  const exportJson = () =>
    downloadBlob(new Blob([exportCardSetJson(set)], { type: 'application/json' }), `${base}.json`)
  const exportZip = async () => downloadBlob(await exportCardSetZip(set), `${base}.zip`)
  const exportPng = async () => downloadBlob(await exportImagesZip(set), `${base}_images.zip`)
  const exportCard = async (card: Card, what: 'efuda' | 'yomifuda' | 'json') => {
    const fb = cardFileBase(card, selectedIndex < 0 ? 0 : selectedIndex)
    if (what === 'json') {
      downloadBlob(new Blob([exportCardJson(card)], { type: 'application/json' }), `${fb}.json`)
    } else if (what === 'efuda' && card.efudaImage) {
      // バッジ表示中なら合成して書き出す
      downloadDataUrl(await composeEfudaPng(card), `${fb}_efuda.png`)
    } else if (what === 'yomifuda' && card.yomifudaImage) {
      downloadDataUrl(card.yomifudaImage, `${fb}_yomifuda.png`)
    }
  }

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <Link to="/editor" className="btn small">
            ← 一覧
          </Link>
          <h1 style={{ margin: 0 }}>{set.name}</h1>
          {dirty && <span className="small" style={{ color: 'var(--accent)' }}>● 未保存</span>}
          {message && <span className="small muted">{message}</span>}
        </div>
        <div className="row">
          <Link className="btn small" to={`/play/${set.id}/timeattack-all`}>
            ▶ 試しに遊ぶ
          </Link>
          <button className="btn primary" onClick={() => void save()} disabled={!!busy}>
            💾 保存 (Ctrl+S)
          </button>
        </div>
      </div>

      {busy && (
        <div className="notice">
          {busy}… {progress && `${progress[0]} / ${progress[1]}`}
          {progress && (
            <div className="progress" style={{ marginTop: 4 }}>
              <div style={{ width: `${(progress[0] / progress[1]) * 100}%` }} />
            </div>
          )}
        </div>
      )}
      {error && <div className="error small">{error}</div>}

      <div className="card-panel">
        <div className="grid cols-2">
          <label className="field">
            <span>セット名</span>
            <input type="text" value={set.name} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} />
          </label>
          <label className="field">
            <span>説明</span>
            <input
              type="text"
              value={set.description}
              onChange={(e) => update((s) => ({ ...s, description: e.target.value }))}
            />
          </label>
        </div>
        <div className="row">
          <span className="small muted">一括操作:</span>
          <button className="btn small" onClick={() => void genAllImages(false)} disabled={!!busy}>
            🎨 未設定の画像を自動生成
          </button>
          <button className="btn small" onClick={() => void genAllImages(true)} disabled={!!busy}>
            🎨 全画像を再生成
          </button>
          <span className="small muted">| 書き出し:</span>
          <button className="btn small" onClick={exportJson}>
            JSON
          </button>
          <button className="btn small" onClick={() => void exportZip()}>
            ZIP（画像分離）
          </button>
          <button className="btn small" onClick={() => void exportPng()}>
            PNG 一括（印刷用）
          </button>
        </div>
        {errors.length > 0 && (
          <div className="error small" style={{ marginTop: '0.6em' }}>
            {errors.slice(0, 5).map((e, i) => (
              <div key={i}>{e}</div>
            ))}
            {errors.length > 5 && <div>…ほか {errors.length - 5} 件</div>}
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 1fr) minmax(300px, 1.2fr)' }}>
        <div className="card-panel">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.6em' }}>
            <h2 style={{ margin: 0 }}>札一覧（{set.cards.length}）</h2>
            <div className="row">
              <button className="btn small" onClick={() => cardFileRef.current?.click()} title="書き出した札 JSON を追加">
                📥 札 JSON
              </button>
              <input
                ref={cardFileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => e.target.files?.[0] && void importCardFile(e.target.files[0])}
              />
              <button className="btn small primary" onClick={addCard}>
                ＋ 札を追加
              </button>
            </div>
          </div>
          <div className="card-list">
            {orderedCards.map((c) => (
              <div
                key={c.id}
                className={`card-thumb ${c.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                {c.efudaImage ? <img src={c.efudaImage} alt={c.kana} /> : <div className="noimg">{c.kana || '?'}</div>}
                <div style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>{c.kana || '？'}</strong> {c.yomi || <span className="muted">（未入力）</span>}
                </div>
                <div className="small muted">
                  {c.audio ? '🔊' : ''}
                  {c.yomifudaImage ? '📄' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-panel">
          {selected ? (
            <CardForm
              key={selected.id}
              card={selected}
              index={selectedIndex}
              total={set.cards.length}
              onChange={(patch) => updateCard(selected.id, patch)}
              onDelete={() => removeCard(selected.id)}
              onMove={(d) => moveCard(selected.id, d)}
              onGenerateImage={(w) => void genImagesFor(selected, w)}
              onUploadImage={(w, f) => void uploadImage(selected, w, f)}
              onUploadAudio={(f) => void uploadAudio(selected, f)}
              onExport={(what) => void exportCard(selected, what)}
              onApplyBadgeToAll={applyBadgeToAll}
              busy={!!busy}
            />
          ) : (
            <p className="muted">左の一覧から札を選ぶか、「札を追加」を押してください。</p>
          )}
        </div>
      </div>
    </div>
  )
}

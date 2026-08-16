import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCardSetList } from '../hooks/useCardSets'
import { useServices } from '../ServicesContext'
import { createEmptyCardSet } from '../../domain/card'
import { createDummyCardSet } from '../../generator/dummy'
import {
  importCardSetJson,
  importCardSetZip,
  exportCardSetJson,
  exportCardSetZip,
  downloadBlob,
  safeFilename,
} from '../../generator/io'
import { DeckThumbs } from '../components/DeckThumbs'

export function EditorListPage() {
  const nav = useNavigate()
  const { cardSets, scores } = useServices()
  const { list, loading, reload } = useCardSetList()
  const [dummyCount, setDummyCount] = useState(44)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const createNew = async () => {
    const set = createEmptyCardSet()
    await cardSets.save(set)
    nav(`/editor/${set.id}`)
  }

  const createDummy = async () => {
    setBusy(true)
    try {
      const set = await createDummyCardSet({ count: dummyCount })
      await cardSets.save(set)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const onImport = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const set = file.name.toLowerCase().endsWith('.zip')
        ? await importCardSetZip(file, { regenerateIds: true })
        : importCardSetJson(await file.text(), { regenerateIds: true })
      await cardSets.save(set)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportDeck = async (id: string, kind: 'json' | 'zip') => {
    setError(null)
    setBusy(true)
    try {
      const set = await cardSets.get(id)
      if (!set) throw new Error('札セットが見つかりません')
      const base = safeFilename(set.name)
      if (kind === 'json') {
        downloadBlob(new Blob([exportCardSetJson(set)], { type: 'application/json' }), `${base}.json`)
      } else {
        downloadBlob(await exportCardSetZip(set), `${base}.zip`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？記録も削除されます。`)) return
    await cardSets.delete(id)
    await scores.clear(id)
    await reload()
  }

  return (
    <div className="grid" style={{ gap: '1.2rem' }}>
      <div>
        <h1>札をつくる</h1>
        <p className="muted">
          札セット＝1 つのかるた。頭文字・読み札の文・絵札画像を登録します。画像は自分で用意しても、自動生成しても OK。
        </p>
      </div>

      <div className="card-panel">
        <div className="row">
          <button className="btn primary" onClick={() => void createNew()}>
            ＋ 新しい札セット
          </button>
          <span className="muted">|</span>
          <label className="row">
            <input
              type="number"
              min={1}
              max={46}
              value={dummyCount}
              onChange={(e) => setDummyCount(Number(e.target.value))}
              style={{ width: '5em' }}
            />
            枚の
          </label>
          <button className="btn" onClick={() => void createDummy()} disabled={busy}>
            {busy ? '生成中…' : 'ダミーセットを生成'}
          </button>
          <span className="muted">|</span>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            📥 インポート (.json / .zip)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            hidden
            onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])}
          />
        </div>
        {error && (
          <p className="error" style={{ marginTop: '0.6em' }}>
            {error}
          </p>
        )}
      </div>

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : list.length === 0 ? (
        <p className="muted">札セットはまだありません。</p>
      ) : (
        <div className="grid cols-3">
          {list.map((s) => (
            <div key={s.id} className="card-panel">
              <h3>{s.name}</h3>
              <DeckThumbs thumbnails={s.thumbnails} size={56} />
              <div className="small muted">
                {s.cardCount} 枚 ・ 更新 {new Date(s.updatedAt).toLocaleDateString()}
              </div>
              {s.description && <p className="small">{s.description}</p>}
              <div className="row" style={{ marginTop: '0.5em' }}>
                <Link className="btn small primary" to={`/editor/${s.id}`}>
                  編集
                </Link>
                <button className="btn small" onClick={() => void exportDeck(s.id, 'json')} disabled={busy}>
                  📤 JSON
                </button>
                <button className="btn small" onClick={() => void exportDeck(s.id, 'zip')} disabled={busy}>
                  📤 ZIP
                </button>
                <button className="btn small danger" onClick={() => void remove(s.id, s.name)}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

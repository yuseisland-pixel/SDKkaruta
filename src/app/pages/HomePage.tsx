import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCardSetList } from '../hooks/useCardSets'
import { useRules } from '../hooks/useRules'
import { useServices, useSettings } from '../ServicesContext'
import { VoicePicker } from '../components/VoicePicker'
import { DeckThumbs } from '../components/DeckThumbs'
import { createDummyCardSet } from '../../generator/dummy'
import { formatTime } from '../../domain/engine'
import { resolveCardCount } from '../../domain/rules'
import { CPU_PROFILES, type CpuLevel } from '../../domain/cpu'
import type { ScoreRecord } from '../../domain/score'
import type { GameMode } from '../../adapters/storage/LocalSettings'

const MODES: { id: GameMode; name: string; desc: string }[] = [
  { id: 'solo', name: 'ソロ', desc: '1 人でタイムアタック。ベストタイムを記録' },
  { id: 'pvp', name: '2 人対戦', desc: '1 台の画面を上下に分けて早押し。取った枚数で勝負' },
  { id: 'cpu', name: 'CPU 対戦', desc: 'CPU と 1 対 1。難易度を選べます' },
]

export function HomePage() {
  const nav = useNavigate()
  const { cardSets, scores } = useServices()
  const { settings, updateSettings } = useSettings()
  const { list, loading, reload } = useCardSetList()
  const { all: rules } = useRules()
  const [setId, setSetId] = useState<string | undefined>(settings.lastCardSetId)
  const [ruleId, setRuleId] = useState<string>(settings.lastRuleId ?? rules[0].id)
  const [best, setBest] = useState<ScoreRecord | undefined>()
  const [creating, setCreating] = useState(false)
  const mode = settings.mode

  // 初期選択の補正
  useEffect(() => {
    if (loading) return
    if (!setId || !list.some((s) => s.id === setId)) setSetId(list[0]?.id)
  }, [loading, list, setId])

  // 対戦時に使えないルール（読み上げモード）や削除されたルールが選ばれていたら補正
  const visibleRules = mode === 'solo' ? rules : rules.filter((r) => !r.readOnly)
  useEffect(() => {
    if (!visibleRules.some((r) => r.id === ruleId)) setRuleId(visibleRules[0]?.id ?? rules[0].id)
  }, [visibleRules, rules, ruleId])

  useEffect(() => {
    if (!setId) return setBest(undefined)
    void scores.getBest(setId, ruleId).then(setBest)
  }, [scores, setId, ruleId])

  const selectedSet = list.find((s) => s.id === setId)
  const selectedRule = rules.find((r) => r.id === ruleId) ?? rules[0]

  const start = () => {
    if (!setId) return
    updateSettings({ lastCardSetId: setId, lastRuleId: ruleId })
    const q = new URLSearchParams({ mode })
    if (mode === 'cpu') q.set('cpu', settings.cpuLevel)
    nav(`/play/${setId}/${ruleId}?${q}`)
  }

  const makeDummy = async () => {
    setCreating(true)
    const set = await createDummyCardSet({ count: 44 })
    await cardSets.save(set)
    await reload()
    setSetId(set.id)
    setCreating(false)
  }

  return (
    <div className="grid" style={{ gap: '1.2rem' }}>
      <section>
        <h1>あそぶ</h1>
        <p className="muted">札セット・モード・ルールを選んでスタート。スマホは横画面がおすすめです。</p>
      </section>

      <section className="card-panel">
        <h2>1. 札セット</h2>
        {loading ? (
          <p className="muted">読み込み中…</p>
        ) : list.length === 0 ? (
          <div className="notice">
            <p>まだ札セットがありません。</p>
            <div className="row">
              <button className="btn primary" onClick={() => void makeDummy()} disabled={creating}>
                {creating ? '生成中…' : 'ダミーかるた（44枚）を自動生成'}
              </button>
              <Link className="btn" to="/editor">
                自分で作る / インポート
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid cols-3">
            {list.map((s) => (
              <div
                key={s.id}
                className={`selectable ${s.id === setId ? 'selected' : ''}`}
                onClick={() => setSetId(s.id)}
                role="button"
              >
                <strong>{s.name}</strong>
                <DeckThumbs thumbnails={s.thumbnails} />
                <div className="small muted">{s.cardCount} 枚</div>
                {s.description && <div className="small">{s.description}</div>}
              </div>
            ))}
          </div>
        )}
        {list.length > 0 && (
          <p className="small muted" style={{ marginTop: '0.6em' }}>
            <Link to="/editor">札セットを追加・編集する →</Link>
          </p>
        )}
      </section>

      <section className="card-panel">
        <h2>2. モード</h2>
        <div className="grid cols-3">
          {MODES.map((m) => (
            <div
              key={m.id}
              className={`selectable ${m.id === mode ? 'selected' : ''}`}
              onClick={() => updateSettings({ mode: m.id })}
              role="button"
            >
              <strong>{m.name}</strong>
              <div className="small">{m.desc}</div>
            </div>
          ))}
        </div>
        {mode === 'pvp' && (
          <div className="row" style={{ marginTop: '0.8em' }}>
            <label className="field" style={{ margin: 0 }}>
              <span>上段（プレイヤー1）</span>
              <input
                type="text"
                value={settings.p1Name}
                onChange={(e) => updateSettings({ p1Name: e.target.value })}
                style={{ width: '10em' }}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>下段（プレイヤー2）</span>
              <input
                type="text"
                value={settings.p2Name}
                onChange={(e) => updateSettings({ p2Name: e.target.value })}
                style={{ width: '10em' }}
              />
            </label>
            <label className="check" style={{ marginTop: '1.2em' }}>
              <input
                type="checkbox"
                checked={settings.faceToFace}
                onChange={(e) => updateSettings({ faceToFace: e.target.checked })}
              />
              対面表示（上段を 180° 回転）
            </label>
          </div>
        )}
        {mode === 'cpu' && (
          <div className="row" style={{ marginTop: '0.8em' }}>
            <span className="small muted">CPU の強さ:</span>
            {(Object.keys(CPU_PROFILES) as CpuLevel[]).map((lv) => (
              <button
                key={lv}
                className={`btn small ${settings.cpuLevel === lv ? 'secondary' : ''}`}
                onClick={() => updateSettings({ cpuLevel: lv })}
              >
                {CPU_PROFILES[lv].label}
              </button>
            ))}
            <label className="field" style={{ margin: 0 }}>
              <span>あなたの名前</span>
              <input
                type="text"
                value={settings.p1Name}
                onChange={(e) => updateSettings({ p1Name: e.target.value })}
                style={{ width: '10em' }}
              />
            </label>
          </div>
        )}
        {mode !== 'solo' && (
          <p className="small muted" style={{ marginTop: '0.6em' }}>
            対戦ではお手つきすると、その札が終わるまで（またはペナルティ秒数の間）取れなくなります。
          </p>
        )}
      </section>

      <section className="card-panel">
        <h2>3. ルール</h2>
        <div className="grid cols-2">
          {visibleRules.map((r) => (
            <div
              key={r.id}
              className={`selectable ${r.id === ruleId ? 'selected' : ''}`}
              onClick={() => setRuleId(r.id)}
              role="button"
            >
              <strong>{r.name}</strong>
              {selectedSet && (
                <span className="small muted"> — {resolveCardCount(r, selectedSet.cardCount)} 枚</span>
              )}
              <div className="small">{r.description}</div>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: '0.6em' }}>
          <Link to="/rules">カスタムルールを作る →</Link>
        </p>
      </section>

      <section className="card-panel">
        <h2>4. 読み上げの声</h2>
        <VoicePicker />
      </section>

      <section className="card-panel row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="small muted">ベストタイム（ソロ・{selectedRule.name}）</div>
          <div style={{ fontSize: '1.4em', fontWeight: 700 }}>
            {best ? formatTime(best.timeMs) : '—'}
            {best && best.misses > 0 && <span className="small muted">（お手つき {best.misses}）</span>}
          </div>
        </div>
        <button className="btn primary big" onClick={start} disabled={!setId}>
          ▶ スタート
        </button>
      </section>
    </div>
  )
}

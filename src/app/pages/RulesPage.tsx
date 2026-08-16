import { useState } from 'react'
import { useRules } from '../hooks/useRules'
import { useServices } from '../ServicesContext'
import { createCustomRule, GameRuleSchema, PRESET_RULES, type GameRule } from '../../domain/rules'

export function RulesPage() {
  const { rules: repo } = useServices()
  const { custom, reload } = useRules()
  const [editing, setEditing] = useState<GameRule | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startNew = (base?: GameRule) => {
    const { id: _id, builtin: _b, name, ...rest } = base ?? PRESET_RULES[0]
    setEditing(createCustomRule({ ...rest, name: base ? `${name}（コピー）` : 'カスタムルール' }))
    setError(null)
  }

  const save = async () => {
    if (!editing) return
    const parsed = GameRuleSchema.safeParse(editing)
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / '))
      return
    }
    await repo.save(parsed.data)
    await reload()
    setEditing(null)
  }

  const remove = async (id: string) => {
    if (!confirm('このルールを削除しますか？')) return
    await repo.delete(id)
    await reload()
  }

  const set = <K extends keyof GameRule>(k: K, v: GameRule[K]) => setEditing((e) => (e ? { ...e, [k]: v } : e))

  return (
    <div className="grid" style={{ gap: '1.2rem' }}>
      <div>
        <h1>ルール</h1>
        <p className="muted">プリセットをもとにカスタムルールを作れます（枚数・お手つき処理・読み札表示など）。</p>
      </div>

      <div className="card-panel">
        <h2>プリセット</h2>
        <div className="grid cols-2">
          {PRESET_RULES.map((r) => (
            <div key={r.id} className="selectable" style={{ cursor: 'default' }}>
              <strong>{r.name}</strong>
              <div className="small">{r.description}</div>
              <button className="btn small" style={{ marginTop: 6 }} onClick={() => startNew(r)}>
                これをもとに作る
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card-panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>カスタムルール</h2>
          <button className="btn primary small" onClick={() => startNew()}>
            ＋ 新規
          </button>
        </div>
        {custom.length === 0 && <p className="muted small">まだありません。</p>}
        <div className="grid cols-2" style={{ marginTop: '0.6em' }}>
          {custom.map((r) => (
            <div key={r.id} className="selectable" style={{ cursor: 'default' }}>
              <strong>{r.name}</strong>
              <div className="small">{r.description}</div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn small" onClick={() => setEditing(r)}>
                  編集
                </button>
                <button className="btn small danger" onClick={() => void remove(r.id)}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="card-panel">
          <h2>ルールを編集</h2>
          <div className="grid cols-2">
            <label className="field">
              <span>名前</span>
              <input type="text" value={editing.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="field">
              <span>説明</span>
              <input type="text" value={editing.description} onChange={(e) => set('description', e.target.value)} />
            </label>
            <label className="field">
              <span>枚数（0 = 全札）</span>
              <input
                type="number"
                min={0}
                value={editing.cardCount === 'all' ? 0 : editing.cardCount}
                onChange={(e) => set('cardCount', Number(e.target.value) > 0 ? Number(e.target.value) : 'all')}
              />
            </label>
            <label className="field">
              <span>枚数を減らすときの選び方</span>
              <select value={editing.pick} onChange={(e) => set('pick', e.target.value as GameRule['pick'])}>
                <option value="random">ランダム</option>
                <option value="head">先頭から</option>
              </select>
            </label>
            <label className="field">
              <span>お手つき</span>
              <select value={editing.onMiss} onChange={(e) => set('onMiss', e.target.value as GameRule['onMiss'])}>
                <option value="penalty">ペナルティ秒を加算</option>
                <option value="gameover">即終了（サドンデス）</option>
                <option value="ignore">無視（カウントのみ）</option>
              </select>
            </label>
            <label className="field">
              <span>ペナルティ秒</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={editing.penaltySec}
                onChange={(e) => set('penaltySec', Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>次の札までの待ち時間 (ms)</span>
              <input
                type="number"
                min={0}
                step={100}
                value={editing.autoNextDelayMs}
                onChange={(e) => set('autoNextDelayMs', Number(e.target.value))}
              />
            </label>
          </div>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={editing.showYomiText} onChange={(e) => set('showYomiText', e.target.checked)} />
              読み札の文を表示
            </label>
            <label className="check">
              <input type="checkbox" checked={editing.readOnly} onChange={(e) => set('readOnly', e.target.checked)} />
              読み上げモード（自動進行）
            </label>
            <label className="check">
              <input type="checkbox" checked={editing.shuffleField} onChange={(e) => set('shuffleField', e.target.checked)} />
              場をシャッフル
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={editing.shuffleReading}
                onChange={(e) => set('shuffleReading', e.target.checked)}
              />
              読み順をシャッフル
            </label>
            <label className="check">
              <input type="checkbox" checked={editing.removeTaken} onChange={(e) => set('removeTaken', e.target.checked)} />
              取った札を消す
            </label>
          </div>
          {error && <p className="error small">{error}</p>}
          <div className="row" style={{ marginTop: '0.8em' }}>
            <button className="btn primary" onClick={() => void save()}>
              保存
            </button>
            <button className="btn" onClick={() => setEditing(null)}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

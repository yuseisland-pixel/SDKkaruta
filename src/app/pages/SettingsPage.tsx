import { useState } from 'react'
import { useServices, useSettings } from '../ServicesContext'
import { VoicePicker } from '../components/VoicePicker'
import { readingTextOf, type Card } from '../../domain/card'

const TEST_CARD: Card = { id: 'test', order: 0, kana: 'て', yomi: 'テスト読み上げです。かるたを始めましょう。' }

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const { speech, scores } = useServices()
  const [testing, setTesting] = useState(false)

  const test = async () => {
    setTesting(true)
    try {
      await speech.speak(
        TEST_CARD,
        { id: '', name: '', description: '', version: 1, createdAt: '', updatedAt: '', cards: [] },
        { voiceId: settings.voiceId, rate: settings.rate },
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="grid" style={{ gap: '1.2rem' }}>
      <h1>設定</h1>

      <div className="card-panel">
        <h2>読み上げ</h2>
        <VoicePicker />
        <label className="field" style={{ marginTop: '0.8em', maxWidth: 360 }}>
          <span>速度: {settings.rate.toFixed(2)}</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={settings.rate}
            onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
          />
        </label>
        <button className="btn" onClick={() => void test()} disabled={testing}>
          ▶ テスト再生
        </button>
        <p className="small muted">「{readingTextOf(TEST_CARD)}」</p>
      </div>

      <div className="card-panel">
        <h2>対戦</h2>
        <div className="grid cols-2">
          <label className="field">
            <span>プレイヤー1 の名前</span>
            <input type="text" value={settings.p1Name} onChange={(e) => updateSettings({ p1Name: e.target.value })} />
          </label>
          <label className="field">
            <span>プレイヤー2 の名前</span>
            <input type="text" value={settings.p2Name} onChange={(e) => updateSettings({ p2Name: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card-panel">
        <h2>データ</h2>
        <p className="small muted">札セットと記録はこのブラウザ内（IndexedDB）に保存されています。</p>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('全ての記録（ベストタイム）を削除しますか？')) void scores.clear()
          }}
        >
          記録を全削除
        </button>
      </div>
    </div>
  )
}

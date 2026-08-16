import { useEffect, useState } from 'react'
import { useServices, useSettings } from '../ServicesContext'
import type { VoiceOption } from '../../ports/SpeechProvider'

/** 読み上げの声を選ぶ */
export function VoicePicker({ compact = false }: { compact?: boolean }) {
  const { speech } = useServices()
  const { settings, updateSettings } = useSettings()
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    setLoading(true)
    setVoices(await speech.listVoices())
    setLoading(false)
  }
  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grouped = new Map<string, VoiceOption[]>()
  for (const v of voices) {
    if (!grouped.has(v.providerId)) grouped.set(v.providerId, [])
    grouped.get(v.providerId)!.push(v)
  }
  const label = (pid: string) => speech.find(pid)?.label ?? pid

  return (
    <div>
      <div className="row">
        <select
          value={settings.voiceId ?? ''}
          onChange={(e) => updateSettings({ voiceId: e.target.value || undefined })}
          style={{ maxWidth: compact ? 320 : undefined }}
        >
          <option value="">自動（札の登録音声 → ブラウザ音声）</option>
          {[...grouped.entries()].map(([pid, list]) => (
            <optgroup key={pid} label={label(pid)}>
              {list.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="btn small" onClick={() => void reload()} disabled={loading}>
          {loading ? '取得中…' : '再取得'}
        </button>
      </div>
      {!compact && (
        <p className="small muted" style={{ marginTop: '0.4em' }}>
          ブラウザ音声の声質は OS / ブラウザにインストールされている日本語音声に依存します。
        </p>
      )}
    </div>
  )
}

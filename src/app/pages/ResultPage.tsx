import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ScoreRecord } from '../../domain/score'
import { formatTime } from '../../domain/engine'
import { useServices } from '../ServicesContext'

interface ResultState {
  record: ScoreRecord
  prevBest?: ScoreRecord
  setName: string
  ruleName: string
  setId: string
  ruleId: string
  playUrl?: string
}

export function ResultPage() {
  const loc = useLocation()
  const nav = useNavigate()
  const { scores } = useServices()
  const st = loc.state as ResultState | null
  const [history, setHistory] = useState<ScoreRecord[]>([])

  useEffect(() => {
    if (!st) return
    void scores.list(st.setId, st.ruleId).then((l) => setHistory(l.slice(0, 10)))
  }, [scores, st])

  if (!st) {
    return (
      <div>
        <p className="muted">結果がありません。</p>
        <Link className="btn" to="/">
          ホームへ
        </Link>
      </div>
    )
  }
  const { record, prevBest } = st
  const versus = !!record.players && record.players.length > 1
  const playUrl = st.playUrl ?? `/play/${st.setId}/${st.ruleId}`

  let title: string
  if (record.finishReason === 'aborted') title = '中断しました'
  else if (versus) {
    if (record.finishReason === 'gameover') title = '💥 お手つきで終了'
    else if (record.winnerIndex == null) title = '🤝 引き分け！'
    else title = `🏆 ${record.players![record.winnerIndex].name} の勝ち！`
  } else {
    title = record.finishReason === 'complete' ? '🎉 クリア！' : '💥 お手つき！ゲームオーバー'
  }
  const isNewBest =
    !versus && record.finishReason === 'complete' && (!prevBest || record.timeMs < prevBest.timeMs)

  return (
    <div className="grid" style={{ gap: '1.2rem' }}>
      <div className="card-panel" style={{ textAlign: 'center' }}>
        <h1>{title}</h1>
        <div className="muted">
          {st.setName} / {st.ruleName}
          {record.mode === 'pvp' && ' / 2 人対戦'}
          {record.mode === 'cpu' && ' / CPU 対戦'}
        </div>

        {versus ? (
          <div className="versus-result">
            {record.players!.map((p, i) => (
              <div key={i} className={`versus-player p${i + 1} ${record.winnerIndex === i ? 'winner' : ''}`}>
                <div className="name">
                  {p.cpu ? '🤖 ' : ''}
                  {p.name}
                </div>
                <div className="taken">{p.taken}</div>
                <div className="small muted">枚 ・ お手つき {p.misses}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '3em', fontWeight: 700, margin: '0.2em 0' }}>{formatTime(record.timeMs)}</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <span>
                取った枚数 {record.takenCount} / {record.totalCount}
              </span>
              <span>お手つき {record.misses}</span>
              {record.timeMs !== record.rawTimeMs && (
                <span className="muted small">（ペナルティ +{formatTime(record.timeMs - record.rawTimeMs)}）</span>
              )}
            </div>
          </>
        )}
        {versus && <div className="small muted">所要時間 {formatTime(record.timeMs)}</div>}
        {isNewBest && <p style={{ color: 'var(--accent)', fontWeight: 700 }}>✨ ベストタイム更新！</p>}
        {!versus && !isNewBest && prevBest && <p className="muted small">ベスト: {formatTime(prevBest.timeMs)}</p>}
        <div className="row" style={{ justifyContent: 'center', marginTop: '1em' }}>
          <button className="btn primary big" onClick={() => nav(playUrl)}>
            🔁 もう一度
          </button>
          <Link className="btn big" to="/">
            ホームへ
          </Link>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card-panel">
          <h2>最近の記録</h2>
          <table className="scores">
            <thead>
              <tr>
                <th>日時</th>
                <th>モード</th>
                <th>タイム</th>
                <th>枚数</th>
                <th>お手つき</th>
                <th>結果</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.playedAt).toLocaleString()}</td>
                  <td>{h.mode === 'pvp' ? '2人' : h.mode === 'cpu' ? 'CPU' : 'ソロ'}</td>
                  <td>{formatTime(h.timeMs)}</td>
                  <td>
                    {h.players && h.players.length > 1
                      ? h.players.map((p) => p.taken).join(' - ')
                      : `${h.takenCount}/${h.totalCount}`}
                  </td>
                  <td>{h.misses}</td>
                  <td>
                    {h.players && h.players.length > 1
                      ? h.winnerIndex == null
                        ? '引き分け'
                        : `${h.players[h.winnerIndex].name} 勝ち`
                      : h.finishReason === 'complete'
                        ? 'クリア'
                        : h.finishReason === 'gameover'
                          ? '終了'
                          : '中断'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { useCardSet } from '../hooks/useCardSets'
import { useRules, findRule } from '../hooks/useRules'
import { useGame } from '../hooks/useGame'
import { useCpuPlayer } from '../hooks/useCpuPlayer'
import { useServices, useSettings } from '../ServicesContext'
import { CardGrid } from '../components/CardGrid'
import { formatTime, type PlayerConfig, type PlayerState } from '../../domain/engine'
import type { CardSet } from '../../domain/card'
import type { GameRule } from '../../domain/rules'
import type { ScoreRecord, ScoreMode } from '../../domain/score'
import { newId } from '../../domain/card'
import { CPU_PROFILES, type CpuLevel } from '../../domain/cpu'

export function PlayPage() {
  const { setId, ruleId } = useParams()
  const [search] = useSearchParams()
  const { set, loading } = useCardSet(setId)
  const { all: rules } = useRules()
  const rule = findRule(rules, ruleId)
  const modeParam = search.get('mode')
  const mode: ScoreMode = modeParam === 'pvp' || modeParam === 'cpu' ? modeParam : 'solo'
  const cpuParam = search.get('cpu')
  const cpuLevel: CpuLevel = cpuParam === 'easy' || cpuParam === 'hard' ? cpuParam : 'normal'

  if (loading) return <div className="container">読み込み中…</div>
  if (!set || !rule)
    return (
      <div className="container">
        <p className="error">札セットまたはルールが見つかりません。</p>
        <Link className="btn" to="/">
          ホームへ
        </Link>
      </div>
    )
  if (set.cards.length === 0)
    return (
      <div className="container">
        <p className="error">この札セットには札がありません。</p>
        <Link className="btn" to={`/editor/${set.id}`}>
          エディタで札を追加
        </Link>
      </div>
    )
  return <GameView set={set} rule={rule} mode={mode} cpuLevel={cpuLevel} />
}

function GameView({ set, rule, mode, cpuLevel }: { set: CardSet; rule: GameRule; mode: ScoreMode; cpuLevel: CpuLevel }) {
  const nav = useNavigate()
  const { scores, speech } = useServices()
  const { settings } = useSettings()

  const players = useMemo<PlayerConfig[] | undefined>(() => {
    if (mode === 'pvp') {
      return [
        { id: 'p1', name: settings.p1Name || 'プレイヤー1' },
        { id: 'p2', name: settings.p2Name || 'プレイヤー2' },
      ]
    }
    if (mode === 'cpu') {
      return [
        { id: 'p1', name: settings.p1Name || 'あなた' },
        { id: 'cpu', name: `CPU（${CPU_PROFILES[cpuLevel].label}）`, cpu: true },
      ]
    }
    return undefined
    // 名前は開始時点のものを使う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cpuLevel])

  const { engine, state, elapsedMs, speaking, feedback, answer, replay, abort, next } = useGame(set, rule, players)
  useCpuPlayer(engine, state, answer, { enabled: mode === 'cpu', level: cpuLevel, playerIndex: 1 })
  const [preparing, setPreparing] = useState(false)
  const savedRef = useRef(false)

  // 事前生成に対応した provider があれば開始直後に裏で走らせる（現状は no-op）
  useEffect(() => {
    let alive = true
    setPreparing(true)
    void speech
      .prepare(state.queue, set, { voiceId: settings.voiceId, rate: settings.rate })
      .catch(() => {})
      .finally(() => alive && setPreparing(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  // 終了 → 記録保存 → 結果画面
  useEffect(() => {
    if (state.phase !== 'finished' || savedRef.current) return
    savedRef.current = true
    const record: ScoreRecord = {
      id: newId('score'),
      cardSetId: set.id,
      ruleId: rule.id,
      timeMs: engine.elapsedMs(),
      rawTimeMs: engine.rawElapsedMs(),
      misses: state.misses,
      takenCount: state.takenCount,
      totalCount: state.queue.length,
      finishReason: state.finishReason ?? 'aborted',
      playedAt: new Date().toISOString(),
      voiceId: settings.voiceId,
      mode,
      players: engine.isVersus()
        ? state.players.map((p) => ({ name: p.name, taken: p.taken, misses: p.misses, cpu: p.cpu }))
        : undefined,
      winnerIndex: engine.isVersus() ? engine.winnerIndex() : undefined,
    }
    void (async () => {
      const prevBest = await scores.getBest(set.id, rule.id)
      if (record.finishReason !== 'aborted' && !rule.readOnly) await scores.save(record)
      nav('/result', {
        replace: true,
        state: {
          record,
          prevBest,
          setName: set.name,
          ruleName: rule.name,
          setId: set.id,
          ruleId: rule.id,
          playUrl: `/play/${set.id}/${rule.id}?${new URLSearchParams({ mode, cpu: cpuLevel })}`,
        },
      })
    })()
  }, [state.phase, state.misses, state.takenCount, state.queue.length, state.finishReason, state.players, engine, scores, nav, set, rule, settings.voiceId, mode, cpuLevel])

  const cur = state.current
  const remaining = engine.remainingCount()
  const versus = engine.isVersus()
  const nowLocked = (i: number) => engine.isLocked(i)

  const topBar = (
    <div className="play-top">
      <div className="timer">{formatTime(elapsedMs)}</div>
      <div className="stat">
        残り {remaining} / {state.queue.length}
      </div>
      {!versus && rule.onMiss !== 'ignore' && <div className="stat">お手つき {state.misses}</div>}
      {versus && (
        <div className="stat row" style={{ gap: '0.5rem' }}>
          {state.players.map((p, i) => (
            <ScoreBadge key={p.id} p={p} index={i} locked={nowLocked(i)} />
          ))}
        </div>
      )}
      {preparing && <div className="stat small">🔊 音声準備中…</div>}
      <div className="spacer" />
      <button className="btn small" onClick={replay} title="もう一度読む">
        🔁 もう一度
      </button>
      {rule.readOnly && (
        <button className="btn small" onClick={next}>
          ⏭ 次へ
        </button>
      )}
      <button className="btn small danger" onClick={abort}>
        ✕ やめる
      </button>
    </div>
  )

  const yomiBar = (
    <div className="yomi-bar">
      {cur ? (
        <>
          <span className="kana">{cur.kana}</span>
          <span>{rule.showYomiText ? cur.yomi : '（読み札はひみつ）'}</span>
          {speaking && <span className="speaking">🔊 読み上げ中</span>}
        </>
      ) : (
        <span className="muted">…</span>
      )}
    </div>
  )

  if (mode === 'pvp') {
    // 上段 = P1、下段 = P2。同じ場を 2 つ描画し、それぞれのタップを各プレイヤーの回答にする
    return (
      <div className="play-root play-split">
        <div className={`play-half top ${settings.faceToFace ? 'face-to-face' : ''}`}>
          <PlayerStrip p={state.players[0]} index={0} locked={nowLocked(0)} cur={cur} showText={rule.showYomiText} />
          <CardGrid
            field={state.field}
            onPick={(id) => answer(id, 0)}
            keepTaken={!rule.removeTaken}
            flash={feedback}
            flashFor={0}
            disabled={state.phase !== 'playing'}
          />
        </div>
        <div className="play-mid">
          <div className="timer">{formatTime(elapsedMs)}</div>
          <span className="stat">
            残り {remaining} / {state.queue.length}
          </span>
          {speaking && <span className="stat">🔊</span>}
          <span className="spacer" />
          <button className="btn small" onClick={replay}>
            🔁
          </button>
          <button className="btn small danger" onClick={abort}>
            ✕
          </button>
        </div>
        <div className="play-half bottom">
          <PlayerStrip p={state.players[1]} index={1} locked={nowLocked(1)} cur={cur} showText={rule.showYomiText} />
          <CardGrid
            field={state.field}
            onPick={(id) => answer(id, 1)}
            keepTaken={!rule.removeTaken}
            flash={feedback}
            flashFor={1}
            disabled={state.phase !== 'playing'}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="play-root">
      <div className="rotate-hint">📱 横画面にすると札が大きく表示されます</div>
      {topBar}
      {yomiBar}
      <CardGrid
        field={state.field}
        onPick={(id) => answer(id, 0)}
        keepTaken={!rule.removeTaken}
        flash={feedback}
        disabled={rule.readOnly || state.phase !== 'playing'}
      />
    </div>
  )
}

function ScoreBadge({ p, index, locked }: { p: PlayerState; index: number; locked: boolean }) {
  return (
    <span className={`score-badge p${index + 1} ${locked ? 'locked' : ''}`} title={p.name}>
      {p.cpu ? '🤖 ' : ''}
      {p.name}: <strong>{p.taken}</strong>
      {locked && ' ⛔'}
    </span>
  )
}

function PlayerStrip({
  p,
  index,
  locked,
  cur,
  showText,
}: {
  p: PlayerState
  index: number
  locked: boolean
  cur: { kana: string; yomi: string } | null
  showText: boolean
}) {
  return (
    <div className={`player-strip p${index + 1} ${locked ? 'locked' : ''}`}>
      <span className="score-badge">
        {p.name}: <strong>{p.taken}</strong> 枚 {locked && '⛔ お手つき中'}
      </span>
      {cur && (
        <span className="yomi-inline">
          <span className="kana">{cur.kana}</span> {showText ? cur.yomi : '（読み札はひみつ）'}
        </span>
      )}
    </div>
  )
}

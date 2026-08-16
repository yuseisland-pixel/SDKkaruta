import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KarutaEngine, type GameState, type PlayerConfig } from '../../domain/engine'
import type { Card, CardSet } from '../../domain/card'
import type { GameRule } from '../../domain/rules'
import { useServices, useSettings } from '../ServicesContext'

export interface GameFeedback {
  type: 'correct' | 'miss' | 'locked'
  cardId: string
  playerIndex: number
  key: number
}

export interface UseGameResult {
  engine: KarutaEngine
  state: GameState
  /** 表示用の経過時間（ms）。50ms ごとに更新 */
  elapsedMs: number
  /** いま読み上げ中か */
  speaking: boolean
  /** 直近のフィードバック（正解/ミスの演出用） */
  feedback: GameFeedback | null
  answer: (cardId: string, playerIndex?: number) => void
  /** 現在の札をもう一度読む */
  replay: () => void
  abort: () => void
  /** 読み上げモードで手動で次へ */
  next: () => void
}

/**
 * エンジン + 読み上げ + タイマー描画をまとめたゲーム進行フック。
 * 読み上げは current が変わるたびに自動で行い、読み上げモードでは終了後に自動で next()。
 * players を渡すと対戦モード（answer に playerIndex を付ける）。
 */
export function useGame(set: CardSet, rule: GameRule, players?: PlayerConfig[]): UseGameResult {
  const { speech } = useServices()
  const { settings } = useSettings()
  const engine = useMemo(() => new KarutaEngine(set.cards, rule, { players }), [set, rule, players])
  const [state, setState] = useState<GameState>(() => engine.getState())
  const [elapsedMs, setElapsed] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [feedback, setFeedback] = useState<GameFeedback | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const startedRef = useRef<KarutaEngine | null>(null)

  // エンジン購読 & 開始（同じ engine を二度 start しない）
  useEffect(() => {
    const off = engine.subscribe(setState)
    if (startedRef.current !== engine) {
      startedRef.current = engine
      engine.start()
    } else {
      setState(engine.getState())
    }
    return () => {
      off()
    }
  }, [engine])

  // タイマー表示（対戦時のロック解除表示にも使うので常に回す）
  useEffect(() => {
    if (state.phase !== 'playing') {
      setElapsed(engine.elapsedMs())
      return
    }
    const t = setInterval(() => setElapsed(engine.elapsedMs()), 50)
    return () => clearInterval(t)
  }, [engine, state.phase])

  const speakCard = useCallback(
    async (card: Card, delayMs: number) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
      if (ctrl.signal.aborted) return
      setSpeaking(true)
      try {
        await speech.speak(card, set, {
          voiceId: settings.voiceId,
          rate: settings.rate,
          signal: ctrl.signal,
        })
      } catch {
        /* 読み上げ失敗はゲーム進行を止めない */
      } finally {
        if (abortRef.current === ctrl) setSpeaking(false)
      }
      if (ctrl.signal.aborted) return
      // 読み上げモード: 読み終わったら待ってから次へ
      if (rule.readOnly) {
        await new Promise((r) => setTimeout(r, rule.autoNextDelayMs))
        if (!ctrl.signal.aborted) engine.next()
      }
    },
    [speech, set, settings.voiceId, settings.rate, rule, engine],
  )

  // current が変わったら読み上げ
  const currentId = state.current?.id
  useEffect(() => {
    if (state.phase !== 'playing' || !state.current) return
    const first = state.currentIndex === 0
    const delay = first ? 300 : rule.readOnly ? 0 : rule.autoNextDelayMs
    void speakCard(state.current, delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, state.phase])

  // 終了時・アンマウント時に停止
  useEffect(() => {
    if (state.phase === 'finished') {
      abortRef.current?.abort()
      speech.stop()
    }
  }, [state.phase, speech])
  // アンマウント時は音声だけ止める（engine.abort() は呼ばない: StrictMode の二重マウントで
  // ゲームが即終了してしまうため。画面遷移で捨てられた engine はそのまま GC される）
  useEffect(
    () => () => {
      abortRef.current?.abort()
      speech.stop()
    },
    [speech],
  )

  const answer = useCallback(
    (cardId: string, playerIndex = 0) => {
      const r = engine.answer(cardId, playerIndex)
      if (r === 'correct' || r === 'miss' || r === 'locked') {
        setFeedback({ type: r, cardId, playerIndex, key: Date.now() })
      }
    },
    [engine],
  )

  const replay = useCallback(() => {
    const cur = engine.getState().current
    if (cur) void speakCard(cur, 0)
  }, [engine, speakCard])

  const abort = useCallback(() => engine.abort(), [engine])
  const next = useCallback(() => {
    abortRef.current?.abort()
    speech.stop()
    engine.next()
  }, [engine, speech])

  return { engine, state, elapsedMs, speaking, feedback, answer, replay, abort, next }
}

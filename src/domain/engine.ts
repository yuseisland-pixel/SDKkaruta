/**
 * かるたゲームの状態機械。UI・タイマー描画・音声再生には関与しない。
 * 時刻取得と乱数は注入可能（テスト容易性・サーバー移植性のため）。
 * プレイヤーは 1 人（ソロ）〜複数（対戦）。対戦時は各プレイヤーが同じ場から札を取り合う。
 */
import type { Card } from './card'
import type { GameRule } from './rules'
import { resolveCardCount } from './rules'

export type GamePhase = 'idle' | 'playing' | 'finished'
export type FinishReason = 'complete' | 'gameover' | 'aborted'

export interface FieldCard {
  card: Card
  taken: boolean
  /** 取ったプレイヤーの index（未取得なら undefined） */
  takenBy?: number
}

export interface GameEvent {
  type: 'correct' | 'miss' | 'advance'
  cardId: string
  playerIndex: number
  at: number
}

export interface PlayerConfig {
  id: string
  name: string
  /** CPU プレイヤーかどうか（表示用。振る舞いは UI 側の useCpuPlayer が担当） */
  cpu?: boolean
}

export interface PlayerState extends PlayerConfig {
  taken: number
  misses: number
  /** この時刻までお手つきロック（対戦時のペナルティ）。0 ならロックなし */
  lockedUntil: number
}

export interface GameState {
  phase: GamePhase
  /** 場の札（表示順） */
  field: FieldCard[]
  /** 読み札の順番 */
  queue: Card[]
  /** queue 上の現在位置 */
  currentIndex: number
  current: Card | null
  /** 全プレイヤー合計 */
  takenCount: number
  misses: number
  /** ソロ時のペナルティ加算（対戦時は使わない） */
  penaltyMs: number
  players: PlayerState[]
  startedAt: number | null
  finishedAt: number | null
  finishReason: FinishReason | null
  lastEvent: GameEvent | null
}

export interface EngineOptions {
  now?: () => number
  random?: () => number
  /** 省略時はソロ 1 人 */
  players?: PlayerConfig[]
}

export type AnswerResult = 'correct' | 'miss' | 'locked' | 'ignored'

export const SOLO_PLAYER: PlayerConfig = { id: 'p1', name: 'プレイヤー' }

export function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class KarutaEngine {
  private readonly now: () => number
  private readonly random: () => number
  private readonly playerConfigs: PlayerConfig[]
  private state: GameState
  private listeners = new Set<(s: GameState) => void>()
  private readonly cards: Card[]
  private readonly rule: GameRule

  constructor(cards: Card[], rule: GameRule, opts: EngineOptions = {}) {
    this.cards = cards
    this.rule = rule
    this.now = opts.now ?? (() => Date.now())
    this.random = opts.random ?? Math.random
    this.playerConfigs = opts.players && opts.players.length > 0 ? opts.players : [SOLO_PLAYER]
    this.state = this.initialState()
  }

  private initialState(): GameState {
    return {
      phase: 'idle',
      field: [],
      queue: [],
      currentIndex: -1,
      current: null,
      takenCount: 0,
      misses: 0,
      penaltyMs: 0,
      players: this.playerConfigs.map((p) => ({ ...p, taken: 0, misses: 0, lockedUntil: 0 })),
      startedAt: null,
      finishedAt: null,
      finishReason: null,
      lastEvent: null,
    }
  }

  getRule(): GameRule {
    return this.rule
  }

  getState(): GameState {
    return this.state
  }

  isVersus(): boolean {
    return this.playerConfigs.length > 1
  }

  subscribe(fn: (s: GameState) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private setState(patch: Partial<GameState>) {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l(this.state)
  }

  /** ゲーム開始。場に出す札を選び、読み順を決める */
  start(): GameState {
    const sorted = [...this.cards].sort((a, b) => a.order - b.order)
    const count = resolveCardCount(this.rule, sorted.length)
    let picked: Card[]
    if (count >= sorted.length) picked = sorted
    else if (this.rule.pick === 'head') picked = sorted.slice(0, count)
    else picked = shuffle(sorted, this.random).slice(0, count).sort((a, b) => a.order - b.order)

    const fieldCards = this.rule.shuffleField ? shuffle(picked, this.random) : picked
    const queue = this.rule.shuffleReading ? shuffle(picked, this.random) : picked

    this.setState({
      ...this.initialState(),
      phase: 'playing',
      field: fieldCards.map((card) => ({ card, taken: false })),
      queue,
      currentIndex: 0,
      current: queue[0] ?? null,
      startedAt: this.now(),
    })
    if (queue.length === 0) this.finish('complete')
    return this.state
  }

  /** プレイヤー（index）が場の札を選んだ */
  answer(cardId: string, playerIndex = 0): AnswerResult {
    const s = this.state
    if (s.phase !== 'playing' || !s.current || this.rule.readOnly) return 'ignored'
    const player = s.players[playerIndex]
    if (!player) return 'ignored'
    const fc = s.field.find((f) => f.card.id === cardId)
    if (!fc || fc.taken) return 'ignored'

    const at = this.now()
    if (player.lockedUntil > at) return 'locked'

    if (fc.card.id === s.current.id) {
      const field = s.field.map((f) => (f.card.id === cardId ? { ...f, taken: true, takenBy: playerIndex } : f))
      const players = s.players.map((p, i) => (i === playerIndex ? { ...p, taken: p.taken + 1 } : p))
      this.setState({
        field,
        players,
        takenCount: s.takenCount + 1,
        lastEvent: { type: 'correct', cardId, playerIndex, at },
      })
      this.advance()
      return 'correct'
    }

    // ミス
    const players = s.players.map((p, i) => (i === playerIndex ? { ...p, misses: p.misses + 1 } : p))
    const event: GameEvent = { type: 'miss', cardId, playerIndex, at }
    switch (this.rule.onMiss) {
      case 'gameover':
        this.setState({ players, misses: s.misses + 1, lastEvent: event })
        this.finish('gameover')
        break
      case 'penalty':
        if (this.isVersus()) {
          // 対戦: そのプレイヤーを一定時間ロック（相手だけが取れる）
          const lockMs = this.rule.penaltySec * 1000
          this.setState({
            players: players.map((p, i) => (i === playerIndex ? { ...p, lockedUntil: at + lockMs } : p)),
            misses: s.misses + 1,
            lastEvent: event,
          })
        } else {
          this.setState({
            players,
            misses: s.misses + 1,
            penaltyMs: s.penaltyMs + this.rule.penaltySec * 1000,
            lastEvent: event,
          })
        }
        break
      case 'ignore':
        this.setState({ players, misses: s.misses + 1, lastEvent: event })
        break
    }
    return 'miss'
  }

  /** 読み上げモードなどで手動/自動で次の札へ進める */
  next(): void {
    const s = this.state
    if (s.phase !== 'playing' || !s.current) return
    if (!this.rule.readOnly) return
    const field = s.field.map((f) => (f.card.id === s.current!.id ? { ...f, taken: true } : f))
    this.setState({
      field,
      takenCount: s.takenCount + 1,
      lastEvent: { type: 'advance', cardId: s.current.id, playerIndex: -1, at: this.now() },
    })
    this.advance()
  }

  private advance() {
    const s = this.state
    const nextIndex = s.currentIndex + 1
    if (nextIndex >= s.queue.length) {
      this.finish('complete')
      return
    }
    // 札が変わったらロックは解除（ロックは「その札を取れない」ペナルティ）
    const players = s.players.map((p) => (p.lockedUntil ? { ...p, lockedUntil: 0 } : p))
    this.setState({ currentIndex: nextIndex, current: s.queue[nextIndex], players })
  }

  abort(): void {
    if (this.state.phase === 'playing') this.finish('aborted')
  }

  private finish(reason: FinishReason) {
    this.setState({ phase: 'finished', finishedAt: this.now(), finishReason: reason, current: null })
  }

  /** 経過時間（ペナルティ込み、ms） */
  elapsedMs(): number {
    const s = this.state
    if (s.startedAt == null) return 0
    const end = s.finishedAt ?? this.now()
    return end - s.startedAt + s.penaltyMs
  }

  /** ペナルティを除いた素の経過時間 */
  rawElapsedMs(): number {
    const s = this.state
    if (s.startedAt == null) return 0
    const end = s.finishedAt ?? this.now()
    return end - s.startedAt
  }

  remainingCount(): number {
    return this.state.field.filter((f) => !f.taken).length
  }

  /** 対戦の勝者 index。同数なら null。ソロなら 0 */
  winnerIndex(): number | null {
    const ps = this.state.players
    if (ps.length <= 1) return 0
    const max = Math.max(...ps.map((p) => p.taken))
    const tops = ps.filter((p) => p.taken === max)
    return tops.length === 1 ? ps.indexOf(tops[0]) : null
  }

  /** プレイヤーが現在ロック中か */
  isLocked(playerIndex: number): boolean {
    const p = this.state.players[playerIndex]
    return !!p && p.lockedUntil > this.now()
  }
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms))
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const cs = Math.floor((total % 1000) / 10)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

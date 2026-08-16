import { describe, it, expect } from 'vitest'
import { KarutaEngine } from './engine'
import { PRESET_RULES } from './rules'
import type { Card } from './card'
import { planCpuMove, CPU_PROFILES } from './cpu'

const cards: Card[] = Array.from({ length: 4 }, (_, i) => ({
  id: `c${i}`,
  order: i,
  kana: 'あいうえ'[i],
  yomi: `読み札 ${i}`,
}))
const rule = (id: string) => PRESET_RULES.find((r) => r.id === id)!
const noShuffle = () => 0
const players = [
  { id: 'p1', name: 'A' },
  { id: 'p2', name: 'B', cpu: true },
]
function makeClock(start = 1000) {
  let t = start
  return { now: () => t, tick: (ms: number) => (t += ms) }
}

describe('対戦モード', () => {
  it('2 人が交互に取ると枚数がそれぞれ加算され、勝者が決まる', () => {
    const eng = new KarutaEngine(cards, rule('timeattack-all'), { random: noShuffle, players })
    eng.start()
    expect(eng.isVersus()).toBe(true)
    expect(eng.getState().players).toHaveLength(2)
    // A, B, A, A の順で取る
    const order = [0, 1, 0, 0]
    for (const p of order) {
      const cur = eng.getState().current!
      expect(eng.answer(cur.id, p)).toBe('correct')
    }
    const s = eng.getState()
    expect(s.phase).toBe('finished')
    expect(s.players[0].taken).toBe(3)
    expect(s.players[1].taken).toBe(1)
    expect(s.takenCount).toBe(4)
    expect(eng.winnerIndex()).toBe(0)
    expect(s.field.filter((f) => f.takenBy === 0)).toHaveLength(3)
  })

  it('同数なら勝者は null', () => {
    const eng = new KarutaEngine(cards, rule('timeattack-all'), { random: noShuffle, players })
    eng.start()
    for (const p of [0, 1, 0, 1]) eng.answer(eng.getState().current!.id, p)
    expect(eng.winnerIndex()).toBeNull()
  })

  it('対戦のお手つきはタイム加算ではなくロック。ロック中は locked、札が変わると解除', () => {
    const clock = makeClock()
    const eng = new KarutaEngine(cards, rule('timeattack-all'), { random: noShuffle, players, now: clock.now })
    eng.start()
    const cur = eng.getState().current!
    const wrong = eng.getState().field.find((f) => f.card.id !== cur.id)!.card
    expect(eng.answer(wrong.id, 0)).toBe('miss')
    expect(eng.getState().penaltyMs).toBe(0)
    expect(eng.getState().players[0].misses).toBe(1)
    expect(eng.isLocked(0)).toBe(true)
    expect(eng.answer(cur.id, 0)).toBe('locked')
    // 相手は取れる
    expect(eng.answer(cur.id, 1)).toBe('correct')
    // 札が進んだのでロック解除
    expect(eng.isLocked(0)).toBe(false)
    expect(eng.answer(eng.getState().current!.id, 0)).toBe('correct')
  })

  it('ロックは時間経過でも解除される', () => {
    const clock = makeClock()
    const eng = new KarutaEngine(cards, rule('timeattack-all'), { random: noShuffle, players, now: clock.now })
    eng.start()
    const cur = eng.getState().current!
    const wrong = eng.getState().field.find((f) => f.card.id !== cur.id)!.card
    eng.answer(wrong.id, 0)
    clock.tick(3001)
    expect(eng.answer(cur.id, 0)).toBe('correct')
  })

  it('ソロは従来どおり winnerIndex=0 で players は 1 人', () => {
    const eng = new KarutaEngine(cards, rule('timeattack-all'), { random: noShuffle })
    eng.start()
    expect(eng.isVersus()).toBe(false)
    expect(eng.getState().players).toHaveLength(1)
    expect(eng.winnerIndex()).toBe(0)
  })
})

describe('planCpuMove', () => {
  const field = cards.map((card) => ({ card, taken: false }))

  it('反応時間はプロファイルの範囲内、ミスしない乱数なら正解を選ぶ', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const p = CPU_PROFILES[level]
      for (const r of [0, 0.5, 0.999]) {
        // 2 回目の random（ミス判定）は 0.999 → ミスしない
        let calls = 0
        const rand = () => (calls++ === 0 ? r : 0.999)
        const mv = planCpuMove(rand, level, field, 'c2')!
        expect(mv.delayMs).toBeGreaterThanOrEqual(p.reactionMinMs)
        expect(mv.delayMs).toBeLessThanOrEqual(p.reactionMaxMs)
        expect(mv.cardId).toBe('c2')
        expect(mv.isMiss).toBe(false)
      }
    }
  })

  it('ミス時は必ず正解以外の残り札を選ぶ', () => {
    let calls = 0
    const rand = () => (calls++ === 1 ? 0 : 0.5) // 2 回目（ミス判定）だけ 0 → ミス
    const mv = planCpuMove(rand, 'easy', field, 'c2')!
    expect(mv.isMiss).toBe(true)
    expect(mv.cardId).not.toBe('c2')
  })

  it('残りが正解のみならミスせず正解を取る', () => {
    const only = [{ card: cards[2], taken: false }]
    const mv = planCpuMove(() => 0, 'easy', only, 'c2')!
    expect(mv.cardId).toBe('c2')
    expect(mv.isMiss).toBe(false)
  })

  it('取れる札が無ければ null', () => {
    expect(planCpuMove(() => 0, 'easy', [], 'c2')).toBeNull()
  })
})

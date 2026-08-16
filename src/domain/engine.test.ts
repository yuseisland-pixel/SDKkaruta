import { describe, it, expect } from 'vitest'
import { KarutaEngine, formatTime, shuffle } from './engine'
import { PRESET_RULES, resolveCardCount, GameRuleSchema } from './rules'
import type { Card } from './card'
import { validateCardSet, createEmptyCardSet } from './card'

const cards: Card[] = Array.from({ length: 6 }, (_, i) => ({
  id: `c${i}`,
  order: i,
  kana: 'あいうえおか'[i],
  yomi: `読み札 ${i}`,
}))

function rule(id: string) {
  const r = PRESET_RULES.find((r) => r.id === id)
  if (!r) throw new Error(id)
  return r
}

/** 決定的な乱数（常に 0 → shuffle が恒等になる） */
const noShuffle = () => 0

function makeClock(start = 1000) {
  let t = start
  return { now: () => t, tick: (ms: number) => (t += ms) }
}

describe('KarutaEngine', () => {
  it('全札タイムアタック: 正解で進み、全部取ると complete', () => {
    const clock = makeClock()
    const eng = new KarutaEngine(cards, rule('timeattack-all'), { now: clock.now, random: noShuffle })
    eng.start()
    expect(eng.getState().phase).toBe('playing')
    expect(eng.getState().field).toHaveLength(6)
    for (let i = 0; i < 6; i++) {
      const cur = eng.getState().current!
      clock.tick(1000)
      expect(eng.answer(cur.id)).toBe('correct')
    }
    const s = eng.getState()
    expect(s.phase).toBe('finished')
    expect(s.finishReason).toBe('complete')
    expect(s.takenCount).toBe(6)
    expect(eng.elapsedMs()).toBe(6000)
  })

  it('ミスでペナルティが加算され、取り済み札は無視される', () => {
    const clock = makeClock()
    const eng = new KarutaEngine(cards, rule('timeattack-all'), { now: clock.now, random: noShuffle })
    eng.start()
    const cur = eng.getState().current!
    const wrong = eng.getState().field.find((f) => f.card.id !== cur.id)!.card
    expect(eng.answer(wrong.id)).toBe('miss')
    expect(eng.getState().misses).toBe(1)
    expect(eng.elapsedMs()).toBe(3000)
    expect(eng.answer(cur.id)).toBe('correct')
    expect(eng.answer(cur.id)).toBe('ignored')
  })

  it('サドンデス: 1 ミスで gameover', () => {
    const eng = new KarutaEngine(cards, rule('sudden-death'), { random: noShuffle })
    eng.start()
    const cur = eng.getState().current!
    const wrong = eng.getState().field.find((f) => f.card.id !== cur.id)!.card
    eng.answer(wrong.id)
    expect(eng.getState().phase).toBe('finished')
    expect(eng.getState().finishReason).toBe('gameover')
    expect(eng.answer(cur.id)).toBe('ignored')
  })

  it('半分タイムアタックは半分の枚数になる', () => {
    const eng = new KarutaEngine(cards, rule('timeattack-half'))
    eng.start()
    expect(eng.getState().field).toHaveLength(3)
    expect(eng.getState().queue).toHaveLength(3)
    expect(resolveCardCount(rule('timeattack-half'), 44)).toBe(22)
  })

  it('読み上げモード: answer は無視、next で進む', () => {
    const eng = new KarutaEngine(cards, rule('reading-only'), { random: noShuffle })
    eng.start()
    const cur = eng.getState().current!
    expect(eng.answer(cur.id)).toBe('ignored')
    eng.next()
    expect(eng.getState().currentIndex).toBe(1)
    for (let i = 0; i < 5; i++) eng.next()
    expect(eng.getState().phase).toBe('finished')
    expect(eng.getState().finishReason).toBe('complete')
  })

  it('abort で aborted になる', () => {
    const eng = new KarutaEngine(cards, rule('timeattack-all'))
    eng.start()
    eng.abort()
    expect(eng.getState().finishReason).toBe('aborted')
  })

  it('subscribe で状態変化を通知する', () => {
    const eng = new KarutaEngine(cards, rule('timeattack-all'), { random: noShuffle })
    let calls = 0
    const off = eng.subscribe(() => calls++)
    eng.start()
    expect(calls).toBeGreaterThan(0)
    off()
    const before = calls
    eng.answer(eng.getState().current!.id)
    expect(calls).toBe(before)
  })
})

describe('helpers', () => {
  it('formatTime', () => {
    expect(formatTime(0)).toBe('0:00.00')
    expect(formatTime(61234)).toBe('1:01.23')
  })
  it('shuffle は要素を保存する', () => {
    const a = [1, 2, 3, 4, 5]
    expect(shuffle(a).sort()).toEqual(a)
  })
  it('GameRuleSchema はデフォルトを埋める', () => {
    const r = GameRuleSchema.parse({ id: 'x', name: 'x', cardCount: 10 })
    expect(r.onMiss).toBe('penalty')
    expect(r.penaltySec).toBe(3)
  })
  it('validateCardSet', () => {
    const set = createEmptyCardSet('t')
    expect(validateCardSet(set)).toContain('札が 1 枚もありません')
    set.cards = [
      { id: 'a', order: 0, kana: 'あ', yomi: 'x' },
      { id: 'b', order: 1, kana: 'あ', yomi: '' },
    ]
    const errs = validateCardSet(set)
    expect(errs.some((e) => e.includes('重複'))).toBe(true)
    expect(errs.some((e) => e.includes('読み札の文が空'))).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { createDummyCardSetData, GOJUON_KEYS } from './dummy'
import { exportCardSetJson, importCardSetJson } from './io'
import { colorForKey } from './renderCard'
import { validateCardSet } from '../domain/card'

describe('dummy', () => {
  it('指定枚数で頭文字が重複しないセットを作る', () => {
    const set = createDummyCardSetData({ count: 22 })
    expect(set.cards).toHaveLength(22)
    expect(new Set(set.cards.map((c) => c.kana)).size).toBe(22)
    expect(validateCardSet(set)).toEqual([])
  })
  it('上限は五十音の数', () => {
    expect(createDummyCardSetData({ count: 999 }).cards).toHaveLength(GOJUON_KEYS.length)
  })
})

describe('io', () => {
  it('JSON export → import ラウンドトリップ', () => {
    const set = createDummyCardSetData({ count: 5 })
    set.cards[0].efudaImage = 'data:image/png;base64,AAAA'
    const json = exportCardSetJson(set)
    const back = importCardSetJson(json)
    expect(back.id).toBe(set.id)
    expect(back.cards[0].efudaImage).toBe('data:image/png;base64,AAAA')
    const regen = importCardSetJson(json, { regenerateIds: true })
    expect(regen.id).not.toBe(set.id)
    expect(regen.cards[0].id).not.toBe(set.cards[0].id)
  })
  it('不正な JSON はエラー', () => {
    expect(() => importCardSetJson('{"foo":1}')).toThrow(/形式/)
  })
})

describe('colorForKey', () => {
  it('同じキーは同じ色', () => {
    expect(colorForKey('あ')).toBe(colorForKey('あ'))
    expect(colorForKey('あ')).not.toBe(colorForKey('い'))
  })
})

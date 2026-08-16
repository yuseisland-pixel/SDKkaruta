import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { resetDbForTest } from './db'
import { IndexedDbCardSetRepository } from './IndexedDbCardSetRepository'
import { IndexedDbScoreRepository } from './IndexedDbScoreRepository'
import { createEmptyCardSet } from '../../domain/card'
import type { ScoreRecord } from '../../domain/score'

beforeEach(() => {
  // 各テストで新しい IndexedDB を使う
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  resetDbForTest()
})

describe('IndexedDbCardSetRepository', () => {
  it('save/get/list/delete', async () => {
    const repo = new IndexedDbCardSetRepository()
    const set = createEmptyCardSet('テスト')
    set.cards.push({ id: 'c1', order: 0, kana: 'あ', yomi: 'あいうえお' })
    await repo.save(set)
    const got = await repo.get(set.id)
    expect(got?.name).toBe('テスト')
    expect(got?.cards).toHaveLength(1)
    const list = await repo.list()
    expect(list).toHaveLength(1)
    expect(list[0].cardCount).toBe(1)
    await repo.delete(set.id)
    expect(await repo.get(set.id)).toBeUndefined()
  })
})

describe('IndexedDbScoreRepository', () => {
  const rec = (over: Partial<ScoreRecord>): ScoreRecord => ({
    id: over.id ?? Math.random().toString(36),
    cardSetId: 's1',
    ruleId: 'r1',
    timeMs: 10000,
    rawTimeMs: 10000,
    misses: 0,
    takenCount: 5,
    totalCount: 5,
    finishReason: 'complete',
    playedAt: new Date().toISOString(),
    ...over,
  })

  it('getBest は完走したものの中で最速', async () => {
    const repo = new IndexedDbScoreRepository()
    await repo.save(rec({ id: 'a', timeMs: 12000 }))
    await repo.save(rec({ id: 'b', timeMs: 8000 }))
    await repo.save(rec({ id: 'c', timeMs: 5000, finishReason: 'aborted', takenCount: 2 }))
    await repo.save(rec({ id: 'd', ruleId: 'other', timeMs: 1000 }))
    const best = await repo.getBest('s1', 'r1')
    expect(best?.id).toBe('b')
    expect(await repo.list('s1', 'r1')).toHaveLength(3)
    await repo.clear('s1')
    expect(await repo.list('s1', 'r1')).toHaveLength(0)
  })
})

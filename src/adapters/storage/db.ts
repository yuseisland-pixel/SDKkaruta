import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CardSet } from '../../domain/card'
import type { ScoreRecord } from '../../domain/score'
import type { GameRule } from '../../domain/rules'

interface KarutaDB extends DBSchema {
  cardSets: {
    key: string
    value: CardSet
    indexes: { byUpdatedAt: string }
  }
  scores: {
    key: string
    value: ScoreRecord
    indexes: { bySetRule: [string, string] }
  }
  rules: {
    key: string
    value: GameRule
  }
}

const DB_NAME = 'sdkkaruta'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<KarutaDB>> | null = null

export function getDb(): Promise<IDBPDatabase<KarutaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KarutaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sets = db.createObjectStore('cardSets', { keyPath: 'id' })
        sets.createIndex('byUpdatedAt', 'updatedAt')
        const scores = db.createObjectStore('scores', { keyPath: 'id' })
        scores.createIndex('bySetRule', ['cardSetId', 'ruleId'])
        db.createObjectStore('rules', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

/** テスト用: 接続をリセット */
export function resetDbForTest() {
  dbPromise = null
}

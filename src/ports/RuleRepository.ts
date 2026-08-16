import type { GameRule } from '../domain/rules'

/** カスタムルールの永続化ポート（プリセットは含まない） */
export interface RuleRepository {
  list(): Promise<GameRule[]>
  save(rule: GameRule): Promise<void>
  delete(id: string): Promise<void>
}

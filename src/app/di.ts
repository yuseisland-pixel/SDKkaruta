/**
 * 依存性の組み立て（Composition Root）。
 * オンライン化する際はここで IndexedDb* → Http* に差し替える。
 */
import { IndexedDbCardSetRepository } from '../adapters/storage/IndexedDbCardSetRepository'
import { IndexedDbScoreRepository } from '../adapters/storage/IndexedDbScoreRepository'
import { IndexedDbRuleRepository } from '../adapters/storage/IndexedDbRuleRepository'
import { WebSpeechProvider } from '../adapters/speech/WebSpeechProvider'
import { AudioFileProvider } from '../adapters/speech/AudioFileProvider'
import { CompositeSpeechProvider } from '../adapters/speech/CompositeSpeechProvider'
import type { CardSetRepository } from '../ports/CardSetRepository'
import type { ScoreRepository } from '../ports/ScoreRepository'
import type { RuleRepository } from '../ports/RuleRepository'

export interface Services {
  cardSets: CardSetRepository
  scores: ScoreRepository
  rules: RuleRepository
  speech: CompositeSpeechProvider
}

export function createServices(): Services {
  const speech = new CompositeSpeechProvider([new AudioFileProvider(), new WebSpeechProvider()])
  return {
    cardSets: new IndexedDbCardSetRepository(),
    scores: new IndexedDbScoreRepository(),
    rules: new IndexedDbRuleRepository(),
    speech,
  }
}

import type { Card, CardSet } from '../domain/card'

export interface VoiceOption {
  /** provider 内で一意な ID */
  id: string
  /** 表示名 */
  name: string
  /** provider の種別 */
  providerId: string
}

export interface SpeakOptions {
  /** 読み上げ速度（1.0 標準） */
  rate?: number
  /** 選択中の声（VoiceOption.id） */
  voiceId?: string
  signal?: AbortSignal
}

/**
 * 読み上げポート。実装: Web Speech / 登録済み音声ファイル / それらの合成。
 * 外部 TTS サービスを足す場合もこのインターフェースを実装して Composite に追加するだけでよい。
 */
export interface SpeechProvider {
  readonly id: string
  readonly label: string
  /** 利用可能か（外部サービスなら接続チェック） */
  isAvailable(): Promise<boolean>
  /** 選択可能な声の一覧 */
  listVoices(): Promise<VoiceOption[]>
  /** 札を読み上げる。再生完了で resolve。 */
  speak(card: Card, set: CardSet, opts?: SpeakOptions): Promise<void>
  /** 再生中なら停止 */
  stop(): void
  /** 事前生成（キャッシュ用途）。未対応なら no-op */
  prepare?(cards: Card[], set: CardSet, opts?: SpeakOptions): Promise<void>
}

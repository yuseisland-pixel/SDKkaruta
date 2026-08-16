import type { Card, CardSet } from '../../domain/card'
import type { SpeakOptions, SpeechProvider, VoiceOption } from '../../ports/SpeechProvider'
import { AudioPlayer } from './AudioPlayer'

/** 札に登録済みの音声ファイル（card.audio）を再生する。登録が無い札は再生できない */
export class AudioFileProvider implements SpeechProvider {
  readonly id = 'file'
  readonly label = '登録済み音声ファイル'
  private player = new AudioPlayer()

  async isAvailable(): Promise<boolean> {
    return typeof Audio !== 'undefined'
  }

  async listVoices(): Promise<VoiceOption[]> {
    return [{ id: `${this.id}:default`, name: '札ごとの登録音声', providerId: this.id }]
  }

  canSpeak(card: Card): boolean {
    return !!card.audio
  }

  async speak(card: Card, _set: CardSet, opts: SpeakOptions = {}): Promise<void> {
    if (!card.audio) throw new Error('この札には音声が登録されていません')
    await this.player.play(card.audio, opts.signal)
  }

  stop(): void {
    this.player.stop()
  }
}

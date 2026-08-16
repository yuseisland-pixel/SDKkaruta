import type { Card, CardSet } from '../../domain/card'
import { readingTextOf } from '../../domain/card'
import type { SpeakOptions, SpeechProvider, VoiceOption } from '../../ports/SpeechProvider'

/** ブラウザ標準の音声合成（Web Speech API）。追加インストール不要のデフォルト */
export class WebSpeechProvider implements SpeechProvider {
  readonly id = 'webspeech'
  readonly label = 'ブラウザ音声合成'

  private get synth(): SpeechSynthesis | undefined {
    return typeof window !== 'undefined' ? window.speechSynthesis : undefined
  }

  async isAvailable(): Promise<boolean> {
    return !!this.synth
  }

  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    const synth = this.synth
    if (!synth) return Promise.resolve([])
    const now = synth.getVoices()
    if (now.length > 0) return Promise.resolve(now)
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(synth.getVoices()), 1500)
      synth.onvoiceschanged = () => {
        clearTimeout(timer)
        resolve(synth.getVoices())
      }
    })
  }

  async listVoices(): Promise<VoiceOption[]> {
    const voices = await this.loadVoices()
    const ja = voices.filter((v) => v.lang.toLowerCase().startsWith('ja'))
    const list = ja.length > 0 ? ja : voices
    return list.map((v) => ({
      id: `${this.id}:${v.voiceURI}`,
      name: `${v.name}${v.lang ? ` (${v.lang})` : ''}`,
      providerId: this.id,
    }))
  }

  speak(card: Card, set: CardSet, opts: SpeakOptions = {}): Promise<void> {
    const synth = this.synth
    if (!synth) return Promise.resolve()
    synth.cancel()
    const text = readingTextOf(card)
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ja-JP'
      u.rate = opts.rate ?? set.voiceConfig?.rate ?? 1
      const voiceUri = opts.voiceId?.startsWith(`${this.id}:`) ? opts.voiceId.slice(this.id.length + 1) : undefined
      if (voiceUri) {
        const v = synth.getVoices().find((v) => v.voiceURI === voiceUri)
        if (v) u.voice = v
      }
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      u.onend = finish
      u.onerror = finish
      opts.signal?.addEventListener('abort', () => {
        synth.cancel()
        finish()
      })
      synth.speak(u)
      // 一部ブラウザで onend が来ないケースの保険
      setTimeout(finish, Math.max(3000, text.length * 400))
    })
  }

  stop(): void {
    this.synth?.cancel()
  }
}

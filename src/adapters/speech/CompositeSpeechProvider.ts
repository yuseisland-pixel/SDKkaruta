import type { Card, CardSet } from '../../domain/card'
import type { SpeakOptions, SpeechProvider, VoiceOption } from '../../ports/SpeechProvider'
import { AudioFileProvider } from './AudioFileProvider'

/**
 * 複数 provider を束ねる。
 * - voiceId が指定されていればその provider を使う（'webspeech:xxx' ならブラウザ音声の該当声）
 * - 未指定なら: 札に音声ファイルがあればそれ → ブラウザ音声合成
 * - 選ばれた provider が失敗したら次の候補にフォールバックする
 */
export class CompositeSpeechProvider implements SpeechProvider {
  readonly id = 'auto'
  readonly label = '自動（登録音声 > ブラウザ音声）'
  private active: SpeechProvider | null = null
  private readonly providers: SpeechProvider[]

  constructor(providers: SpeechProvider[]) {
    this.providers = providers
  }

  getProviders(): SpeechProvider[] {
    return this.providers
  }

  find(id: string): SpeechProvider | undefined {
    return this.providers.find((p) => p.id === id)
  }

  async isAvailable(): Promise<boolean> {
    for (const p of this.providers) if (await p.isAvailable()) return true
    return false
  }

  async listVoices(): Promise<VoiceOption[]> {
    const all: VoiceOption[] = []
    for (const p of this.providers) {
      if (await p.isAvailable()) all.push(...(await p.listVoices()))
    }
    return all
  }

  private async candidatesFor(card: Card, opts: SpeakOptions): Promise<SpeechProvider[]> {
    const ordered: SpeechProvider[] = []
    // 明示指定
    if (opts.voiceId) {
      const pid = opts.voiceId.split(':')[0]
      const p = this.find(pid)
      if (p) ordered.push(p)
    }
    // 札固有の音声ファイル
    for (const p of this.providers) {
      if (p instanceof AudioFileProvider && p.canSpeak(card) && !ordered.includes(p)) ordered.push(p)
    }
    // 残りを優先順で（AudioFile は音声が無いのでスキップ）
    for (const p of this.providers) {
      if (ordered.includes(p)) continue
      if (p instanceof AudioFileProvider) continue
      if (await p.isAvailable()) ordered.push(p)
    }
    return ordered
  }

  async speak(card: Card, set: CardSet, opts: SpeakOptions = {}): Promise<void> {
    const cands = await this.candidatesFor(card, opts)
    let lastErr: unknown
    for (const p of cands) {
      if (opts.signal?.aborted) return
      try {
        this.active = p
        await p.speak(card, set, opts)
        return
      } catch (e) {
        lastErr = e
      }
    }
    if (lastErr) throw lastErr
  }

  async prepare(cards: Card[], set: CardSet, opts: SpeakOptions = {}): Promise<void> {
    const first = cards[0]
    if (!first) return
    const cands = await this.candidatesFor(first, opts)
    const p = cands.find((c) => c.prepare)
    await p?.prepare?.(cards, set, opts)
  }

  stop(): void {
    this.active?.stop()
    for (const p of this.providers) p.stop()
  }
}

/** HTMLAudioElement の薄いラッパー。provider 間で共有する */
export class AudioPlayer {
  private current: HTMLAudioElement | null = null

  play(src: string, signal?: AbortSignal): Promise<void> {
    this.stop()
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(src)
      this.current = audio
      const cleanup = () => {
        if (this.current === audio) this.current = null
      }
      audio.onended = () => {
        cleanup()
        resolve()
      }
      audio.onerror = () => {
        cleanup()
        reject(new Error('音声の再生に失敗しました'))
      }
      signal?.addEventListener('abort', () => {
        audio.pause()
        cleanup()
        resolve()
      })
      audio.play().catch((e) => {
        cleanup()
        reject(e)
      })
    })
  }

  stop(): void {
    if (this.current) {
      this.current.pause()
      this.current.src = ''
      this.current = null
    }
  }
}

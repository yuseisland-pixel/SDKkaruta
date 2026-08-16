import { useEffect } from 'react'
import type { KarutaEngine, GameState } from '../../domain/engine'
import { planCpuMove, type CpuLevel } from '../../domain/cpu'

/**
 * CPU プレイヤー。読み札が変わるたびに反応時間後に札を取りに行く。
 * `enabled=false` なら何もしない。playerIndex は CPU の index（通常 1）。
 */
export function useCpuPlayer(
  engine: KarutaEngine,
  state: GameState,
  answer: (cardId: string, playerIndex: number) => void,
  opts: { enabled: boolean; level: CpuLevel; playerIndex?: number },
) {
  const { enabled, level, playerIndex = 1 } = opts
  const currentId = state.current?.id
  useEffect(() => {
    if (!enabled || state.phase !== 'playing' || !currentId) return
    const move = planCpuMove(Math.random, level, engine.getState().field, currentId)
    if (!move) return
    const t = setTimeout(() => {
      const s = engine.getState()
      // まだ同じ札が読まれていて、対象札が残っていれば取る
      if (s.phase !== 'playing' || s.current?.id !== currentId) return
      const fc = s.field.find((f) => f.card.id === move.cardId)
      if (!fc || fc.taken) return
      answer(move.cardId, playerIndex)
    }, move.delayMs)
    return () => clearTimeout(t)
  }, [enabled, level, playerIndex, currentId, state.phase, engine, answer])
}

import { useCallback, useEffect, useState } from 'react'
import { useServices } from '../ServicesContext'
import { PRESET_RULES, type GameRule } from '../../domain/rules'

/** プリセット + カスタムルール */
export function useRules() {
  const { rules } = useServices()
  const [custom, setCustom] = useState<GameRule[]>([])
  const reload = useCallback(async () => setCustom(await rules.list()), [rules])
  useEffect(() => {
    void reload()
  }, [reload])
  const all = [...PRESET_RULES, ...custom]
  return { all, custom, reload }
}

export function findRule(all: GameRule[], id: string | undefined): GameRule | undefined {
  return all.find((r) => r.id === id)
}

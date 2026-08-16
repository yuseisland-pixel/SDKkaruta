import { useCallback, useEffect, useState } from 'react'
import { useServices } from '../ServicesContext'
import type { CardSet, CardSetSummary } from '../../domain/card'

export function useCardSetList() {
  const { cardSets } = useServices()
  const [list, setList] = useState<CardSetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    setList(await cardSets.list())
    setLoading(false)
  }, [cardSets])
  useEffect(() => {
    void reload()
  }, [reload])
  return { list, loading, reload }
}

export function useCardSet(id: string | undefined) {
  const { cardSets } = useServices()
  const [set, setSet] = useState<CardSet | undefined>()
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    if (!id) {
      setSet(undefined)
      setLoading(false)
      return
    }
    void cardSets.get(id).then((s) => {
      if (!alive) return
      setSet(s)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [cardSets, id])
  return { set, loading, setSet }
}

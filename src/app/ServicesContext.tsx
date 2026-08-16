import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { createServices, type Services } from './di'
import { loadSettings, saveSettings, type AppSettings } from '../adapters/storage/LocalSettings'

interface Ctx {
  services: Services
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const ServicesContext = createContext<Ctx | null>(null)

export function ServicesProvider({ children, services }: { children: ReactNode; services?: Services }) {
  const svc = useMemo(() => services ?? createServices(), [services])
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }
  return <ServicesContext.Provider value={{ services: svc, settings, updateSettings }}>{children}</ServicesContext.Provider>
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('ServicesProvider がありません')
  return ctx.services
}

export function useSettings() {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('ServicesProvider がありません')
  return { settings: ctx.settings, updateSettings: ctx.updateSettings }
}

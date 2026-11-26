import { create } from 'zustand'
import { getGlossary, getHealth, getSettings, listPrompts } from '@/api/settings'
import type { Glossary, Health, Preset, Settings } from '@/api/types'

interface ConfigState {
  settings: Settings | null
  presets: Preset[]
  glossary: Glossary | null
  health: Health | null
  healthError: boolean
  loadSettings: () => Promise<void>
  loadPresets: () => Promise<void>
  loadGlossary: () => Promise<void>
  loadHealth: () => Promise<void>
  loadAll: () => Promise<void>
  setSettings: (s: Settings) => void
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  settings: null,
  presets: [],
  glossary: null,
  health: null,
  healthError: false,

  loadSettings: async () => {
    try {
      set({ settings: await getSettings() })
    } catch {
      /* 后端未就绪时静默 */
    }
  },
  loadPresets: async () => {
    try {
      set({ presets: await listPrompts() })
    } catch {
      /* ignore */
    }
  },
  loadGlossary: async () => {
    try {
      set({ glossary: await getGlossary() })
    } catch {
      /* ignore */
    }
  },
  loadHealth: async () => {
    try {
      set({ health: await getHealth(), healthError: false })
    } catch {
      set({ healthError: true })
    }
  },
  loadAll: async () => {
    const g = get()
    await Promise.all([g.loadSettings(), g.loadPresets(), g.loadGlossary(), g.loadHealth()])
  },
  setSettings: (settings) => set({ settings }),
}))

import { create } from 'zustand'

interface PlayerState {
  el: HTMLAudioElement | null
  currentMs: number
  durationMs: number
  playing: boolean
  rate: number
  error: boolean

  setEl: (el: HTMLAudioElement | null) => void
  patch: (p: Partial<Pick<PlayerState, 'currentMs' | 'durationMs' | 'playing' | 'error'>>) => void
  toggle: () => void
  seekMs: (ms: number, play?: boolean) => void
  skip: (deltaMs: number) => void
  setRate: (r: number) => void
  reset: () => void
}

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2]

export const usePlayerStore = create<PlayerState>((set, get) => ({
  el: null,
  currentMs: 0,
  durationMs: 0,
  playing: false,
  rate: 1,
  error: false,

  setEl: (el) => set({ el }),
  patch: (p) => set(p),

  toggle: () => {
    const { el } = get()
    if (!el) return
    if (el.paused) el.play().catch(() => set({ error: true }))
    else el.pause()
  },

  seekMs: (ms, play = false) => {
    const { el } = get()
    if (!el) return
    el.currentTime = Math.max(0, ms) / 1000
    set({ currentMs: Math.max(0, ms) })
    if (play && el.paused) el.play().catch(() => set({ error: true }))
  },

  skip: (deltaMs) => {
    const { el } = get()
    if (!el) return
    const dur = Number.isFinite(el.duration) ? el.duration * 1000 : Infinity
    const next = Math.min(Math.max(0, el.currentTime * 1000 + deltaMs), dur)
    get().seekMs(next)
  },

  setRate: (rate) => {
    const { el } = get()
    if (el) el.playbackRate = rate
    set({ rate })
  },

  reset: () => set({ currentMs: 0, durationMs: 0, playing: false, error: false }),
}))

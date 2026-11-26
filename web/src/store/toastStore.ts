import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration: number
  action?: { label: string; onClick: () => void }
}

interface ToastOptions {
  duration?: number
  action?: ToastItem['action']
}

interface ToastState {
  toasts: ToastItem[]
  push: (type: ToastType, title: string, message?: string, opts?: ToastOptions) => void
  removeToast: (id: string) => void
  success: (title: string, message?: string, opts?: ToastOptions) => void
  error: (title: string, message?: string, opts?: ToastOptions) => void
  warning: (title: string, message?: string, opts?: ToastOptions) => void
  info: (title: string, message?: string, opts?: ToastOptions) => void
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 7000,
}

let seq = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, title, message, opts) => {
    const id = `toast-${Date.now()}-${seq++}`
    const item: ToastItem = {
      id,
      type,
      title,
      message,
      duration: opts?.duration ?? DEFAULT_DURATION[type],
      action: opts?.action,
    }
    set((s) => ({ toasts: [...s.toasts.slice(-4), item] }))
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  success: (t, m, o) => get().push('success', t, m, o),
  error: (t, m, o) => get().push('error', t, m, o),
  warning: (t, m, o) => get().push('warning', t, m, o),
  info: (t, m, o) => get().push('info', t, m, o),
}))

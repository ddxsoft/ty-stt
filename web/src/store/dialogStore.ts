import { create } from 'zustand'

interface ConfirmRequest {
  kind: 'confirm'
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

interface PromptRequest {
  kind: 'prompt'
  title: string
  label?: string
  initial?: string
  placeholder?: string
  confirmText?: string
  resolve: (value: string | null) => void
}

export type DialogRequest = ConfirmRequest | PromptRequest

interface DialogStoreState {
  request: DialogRequest | null
  close: () => void
}

export const useDialogStore = create<DialogStoreState>((set) => ({
  request: null,
  close: () => set({ request: null }),
}))

/** 命令式确认框 */
export function confirmDialog(opts: {
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.setState({ request: { kind: 'confirm', ...opts, resolve } })
  })
}

/** 命令式输入框，取消返回 null */
export function promptDialog(opts: {
  title: string
  label?: string
  initial?: string
  placeholder?: string
  confirmText?: string
}): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.setState({ request: { kind: 'prompt', ...opts, resolve } })
  })
}

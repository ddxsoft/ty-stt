import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'
export type EditorMode = 'source' | 'split' | 'preview'
export type SettingsTab = 'llm' | 'stt' | 'general' | 'prompts' | 'glossary'

export type DialogState =
  | null
  | { type: 'new'; files?: File[] }
  | { type: 'record' }
  | { type: 'settings'; tab?: SettingsTab }
  | { type: 'move'; docId: string }

interface UiState {
  theme: Theme
  editorMode: EditorMode
  rightOpen: boolean
  outlineOpen: boolean
  transcriptOpen: boolean
  /** 移动端左侧抽屉 */
  leftOpen: boolean
  historyOpen: boolean
  dialog: DialogState

  toggleTheme: () => void
  setEditorMode: (m: EditorMode) => void
  setRightOpen: (v: boolean) => void
  setOutlineOpen: (v: boolean) => void
  setTranscriptOpen: (v: boolean) => void
  setLeftOpen: (v: boolean) => void
  setHistoryOpen: (v: boolean) => void
  openDialog: (d: Exclude<DialogState, null>) => void
  closeDialog: () => void
}

function initialTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: initialTheme(),
      editorMode: 'split',
      rightOpen: true,
      outlineOpen: false,
      transcriptOpen: false,
      leftOpen: false,
      historyOpen: false,
      dialog: null,

      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setEditorMode: (editorMode) => set({ editorMode }),
      setRightOpen: (rightOpen) => set({ rightOpen }),
      setOutlineOpen: (outlineOpen) => set({ outlineOpen }),
      setTranscriptOpen: (transcriptOpen) => set({ transcriptOpen }),
      setLeftOpen: (leftOpen) => set({ leftOpen }),
      setHistoryOpen: (historyOpen) => set({ historyOpen }),
      openDialog: (dialog) => set({ dialog }),
      closeDialog: () => set({ dialog: null }),
    }),
    {
      name: 'ty-stt-ui',
      version: 1,
      partialize: (s) => ({
        theme: s.theme,
        editorMode: s.editorMode,
        rightOpen: s.rightOpen,
        outlineOpen: s.outlineOpen,
        transcriptOpen: s.transcriptOpen,
      }),
    },
  ),
)

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}
applyTheme(useUiStore.getState().theme)
useUiStore.subscribe((s) => applyTheme(s.theme))

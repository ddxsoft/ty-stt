import { create } from 'zustand'
import { polishDocument, polishSelection, polishTitle } from '@/api/polish'
import { getErrorMessage } from '@/api/client'
import type { PolishSource, SelectionAction } from '@/api/types'
import { editorBridge } from '@/lib/editorBridge'
import { useDocStore } from './docStore'
import { useToastStore } from './toastStore'
import { useUiStore } from './uiStore'

export interface SelectionInfo {
  from: number
  to: number
  text: string
}

export type RunStatus = 'streaming' | 'done' | 'error'

export interface DocRun {
  status: RunStatus
  preset: string
  source: PolishSource
  /** 发起时的正文，用于对比 */
  base: string
  text: string
  error?: string
}

export interface SelRun {
  status: RunStatus
  action?: SelectionAction
  instruction?: string
  from: number
  to: number
  original: string
  text: string
  error?: string
}

interface CopilotState {
  preset: string
  source: PolishSource
  selection: SelectionInfo | null
  docRun: DocRun | null
  selRun: SelRun | null
  titleLoading: boolean
  titleSuggestion: { title: string; tags: string[] } | null

  setPreset: (id: string) => void
  setSource: (s: PolishSource) => void
  setSelection: (s: SelectionInfo | null) => void
  reset: () => void

  runDocument: () => Promise<void>
  stopDocument: () => void
  applyDocument: () => Promise<void>
  discardDocument: () => void

  runSelection: (action?: SelectionAction, instruction?: string) => Promise<void>
  stopSelection: () => void
  applySelection: () => void
  discardSelection: () => void

  suggestTitle: () => Promise<void>
  applyTitleSuggestion: () => void
  dismissTitleSuggestion: () => void
}

let docAbort: AbortController | null = null
let selAbort: AbortController | null = null

const CONTEXT_CHARS = 300

function isAbort(e: unknown) {
  return e instanceof DOMException && e.name === 'AbortError'
}

/** 节流地把流式文本写入 store */
function throttled(apply: (text: string) => void) {
  let last = 0
  let latest = ''
  let pending: ReturnType<typeof setTimeout> | null = null
  return {
    push(text: string) {
      latest = text
      const now = Date.now()
      if (now - last >= 90) {
        last = now
        apply(latest)
      } else if (!pending) {
        pending = setTimeout(
          () => {
            pending = null
            last = Date.now()
            apply(latest)
          },
          90 - (now - last),
        )
      }
    },
    cancel() {
      if (pending) clearTimeout(pending)
      pending = null
    },
  }
}

export const useCopilotStore = create<CopilotState>((set, get) => ({
  preset: 'medium',
  source: 'transcript',
  selection: null,
  docRun: null,
  selRun: null,
  titleLoading: false,
  titleSuggestion: null,

  setPreset: (preset) => set({ preset }),
  setSource: (source) => set({ source }),
  setSelection: (selection) => set({ selection }),

  reset: () => {
    docAbort?.abort()
    selAbort?.abort()
    set({ docRun: null, selRun: null, selection: null, titleSuggestion: null, titleLoading: false })
  },

  // ───────── 全文润色 ─────────
  runDocument: async () => {
    const docState = useDocStore.getState()
    const toast = useToastStore.getState()
    const docId = docState.docId
    if (!docId) return
    if (get().docRun?.status === 'streaming') return

    const { preset, source } = get()
    if (source === 'current') {
      // 服务端读取已保存的正文，先落盘
      const ok = await docState.save()
      if (!ok) return
    }
    const base = useDocStore.getState().content

    docAbort?.abort()
    const ctrl = new AbortController()
    docAbort = ctrl
    set({ docRun: { status: 'streaming', preset, source, base, text: '' } })

    let acc = ''
    const th = throttled((text) =>
      set((s) => (s.docRun && s.docRun.status === 'streaming' ? { docRun: { ...s.docRun, text } } : s)),
    )
    try {
      const final = await polishDocument(
        { doc_id: docId, preset, source },
        {
          signal: ctrl.signal,
          onDelta: (t) => {
            acc += t
            th.push(acc)
          },
        },
      )
      th.cancel()
      if (useDocStore.getState().docId !== docId) return
      set((s) => (s.docRun ? { docRun: { ...s.docRun, status: 'done', text: final } } : s))
    } catch (e) {
      th.cancel()
      if (isAbort(e)) {
        set({ docRun: null })
        return
      }
      const msg = getErrorMessage(e, '润色失败')
      toast.error('AI 润色失败', msg)
      set((s) => (s.docRun ? { docRun: { ...s.docRun, status: 'error', error: msg } } : s))
    }
  },

  stopDocument: () => {
    docAbort?.abort()
  },

  applyDocument: async () => {
    const run = get().docRun
    if (!run || run.status !== 'done') return
    const ds = useDocStore.getState()
    // 先把当前正文落盘，让服务端为其生成历史快照
    if (ds.dirty) await ds.save()
    useDocStore.getState().setContent(run.text)
    set({ docRun: null })
    useToastStore.getState().success('已应用润色结果', '原内容保留在「历史版本」中，可随时恢复')
  },

  discardDocument: () => {
    docAbort?.abort()
    set({ docRun: null })
  },

  // ───────── 选区精修 ─────────
  runSelection: async (action, instruction) => {
    const toast = useToastStore.getState()
    const view = editorBridge.get()
    const sel = get().selection
    const docId = useDocStore.getState().docId
    if (!view || !sel || !sel.text.trim()) {
      toast.warning('请先在编辑器中选中文字')
      return
    }
    if (!action && !instruction?.trim()) return
    if (get().selRun?.status === 'streaming') return

    useUiStore.getState().setRightOpen(true)

    const doc = view.state.doc
    const before = doc.sliceString(Math.max(0, sel.from - CONTEXT_CHARS), sel.from)
    const after = doc.sliceString(sel.to, Math.min(doc.length, sel.to + CONTEXT_CHARS))

    selAbort?.abort()
    const ctrl = new AbortController()
    selAbort = ctrl
    set({
      selRun: {
        status: 'streaming',
        action,
        instruction,
        from: sel.from,
        to: sel.to,
        original: sel.text,
        text: '',
      },
    })

    let acc = ''
    const th = throttled((text) =>
      set((s) => (s.selRun && s.selRun.status === 'streaming' ? { selRun: { ...s.selRun, text } } : s)),
    )
    try {
      const final = await polishSelection(
        {
          doc_id: docId ?? undefined,
          selection: sel.text,
          action,
          instruction: instruction?.trim() || undefined,
          before,
          after,
        },
        {
          signal: ctrl.signal,
          onDelta: (t) => {
            acc += t
            th.push(acc)
          },
        },
      )
      th.cancel()
      set((s) => (s.selRun ? { selRun: { ...s.selRun, status: 'done', text: final } } : s))
    } catch (e) {
      th.cancel()
      if (isAbort(e)) {
        set({ selRun: null })
        return
      }
      const msg = getErrorMessage(e, '精修失败')
      toast.error('AI 精修失败', msg)
      set((s) => (s.selRun ? { selRun: { ...s.selRun, status: 'error', error: msg } } : s))
    }
  },

  stopSelection: () => {
    selAbort?.abort()
  },

  applySelection: () => {
    const run = get().selRun
    const view = editorBridge.get()
    if (!run || run.status !== 'done') return
    if (!view) {
      useToastStore.getState().warning('请切换到「源码」或「分屏」模式后再应用')
      return
    }
    let { from, to } = run
    const doc = view.state.doc
    if (to > doc.length || doc.sliceString(from, to) !== run.original) {
      // 文本已变动：尝试重新定位
      const idx = doc.toString().indexOf(run.original)
      if (idx < 0) {
        useToastStore.getState().error('无法应用', '原选区内容已被修改，请重新选择后再试')
        return
      }
      from = idx
      to = idx + run.original.length
    }
    view.dispatch({
      changes: { from, to, insert: run.text },
      selection: { anchor: from, head: from + run.text.length },
    })
    view.focus()
    set({ selRun: null })
  },

  discardSelection: () => {
    selAbort?.abort()
    set({ selRun: null })
  },

  // ───────── 标题 / 标签 ─────────
  suggestTitle: async () => {
    const content = useDocStore.getState().content
    if (!content.trim()) {
      useToastStore.getState().warning('正文为空，无法生成标题')
      return
    }
    const docId = useDocStore.getState().docId
    set({ titleLoading: true, titleSuggestion: null })
    try {
      const r = await polishTitle(content)
      if (useDocStore.getState().docId !== docId) return
      set({ titleSuggestion: r, titleLoading: false })
    } catch (e) {
      set({ titleLoading: false })
      useToastStore.getState().error('生成标题失败', getErrorMessage(e))
    }
  },

  applyTitleSuggestion: () => {
    const s = get().titleSuggestion
    if (!s) return
    const ds = useDocStore.getState()
    if (s.title) ds.setTitle(s.title)
    if (s.tags?.length) {
      const merged = Array.from(new Set([...ds.tags, ...s.tags]))
      ds.setTags(merged)
    }
    set({ titleSuggestion: null })
  },

  dismissTitleSuggestion: () => set({ titleSuggestion: null }),
}))

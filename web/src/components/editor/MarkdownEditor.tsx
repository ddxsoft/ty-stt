import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { Bot, Eraser, Minimize2, Sparkles, SpellCheck } from 'lucide-react'
import { useDocStore } from '@/store/docStore'
import { useCopilotStore } from '@/store/copilotStore'
import { useUiStore } from '@/store/uiStore'
import { editorBridge } from '@/lib/editorBridge'
import type { SelectionAction } from '@/api/types'

const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'hsl(var(--foreground))',
    fontSize: '14.5px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-editor)', lineHeight: '1.9' },
  '.cm-content': { padding: '20px 0 120px', caretColor: 'hsl(var(--accent))' },
  '.cm-line': { padding: '0 28px 0 12px' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'hsl(var(--faint))',
    fontSize: '12px',
  },
  '.cm-activeLine': { backgroundColor: 'hsl(var(--accent) / 0.05)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'hsl(var(--accent))' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'hsl(var(--accent))', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'hsl(var(--accent) / 0.22) !important' },
  '.cm-panels': {
    backgroundColor: 'hsl(var(--surface))',
    color: 'hsl(var(--foreground))',
    borderColor: 'hsl(var(--line))',
  },
  '.cm-searchMatch': { backgroundColor: 'hsl(var(--warning) / 0.3)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'hsl(var(--warning) / 0.55)' },
  '.cm-placeholder': { color: 'hsl(var(--faint))' },
})

const highlight = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', fontSize: '1.3em', color: 'hsl(var(--accent))' },
  { tag: t.heading2, fontWeight: '700', fontSize: '1.15em', color: 'hsl(var(--accent))' },
  { tag: [t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '700', color: 'hsl(var(--accent))' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'hsl(var(--faint))' },
  { tag: t.link, color: 'hsl(var(--info))' },
  { tag: t.url, color: 'hsl(var(--info))', textDecoration: 'underline' },
  { tag: t.monospace, color: 'hsl(var(--warning))' },
  { tag: t.quote, color: 'hsl(var(--subtle))', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.contentSeparator, t.meta], color: 'hsl(var(--faint))' },
  { tag: t.list, color: 'hsl(var(--accent))' },
])

const QUICK: { action: SelectionAction; label: string; icon: typeof Sparkles }[] = [
  { action: 'polish', label: '润色', icon: Sparkles },
  { action: 'fix', label: '纠错', icon: SpellCheck },
  { action: 'shorten', label: '精简', icon: Minimize2 },
]

interface Pop {
  top: number
  left: number
}

/** 鼠标拖拽选词期间不弹出快捷浮层（模块级，避免在渲染作用域内可变） */
let dragging = false

export default function MarkdownEditor() {
  const content = useDocStore((s) => s.content)
  const setContent = useDocStore((s) => s.setContent)
  const [pop, setPop] = useState<Pop | null>(null)

  const extensions = useMemo(() => {
    const computePop = (view: EditorView) => {
      const { from, to, empty } = view.state.selection.main
      if (empty || dragging) {
        setPop(null)
        return
      }
      const a = view.coordsAtPos(from)
      const b = view.coordsAtPos(to)
      const box = view.scrollDOM.getBoundingClientRect()
      if (!a || !b || a.top < box.top || b.bottom > box.bottom + 4) {
        setPop(null)
        return
      }
      const width = 280
      const above = a.top - 44
      const top = above > box.top + 4 ? above : b.bottom + 8
      const left = Math.min(Math.max(a.left, box.left + 8), box.right - width - 8)
      setPop({ top, left })
    }

    return [
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      theme,
      syntaxHighlighting(highlight),
      EditorView.updateListener.of((u) => {
        if (u.selectionSet || u.docChanged) {
          const { from, to, empty } = u.state.selection.main
          useCopilotStore
            .getState()
            .setSelection(empty ? null : { from, to, text: u.state.sliceDoc(from, to) })
          const view = u.view
          requestAnimationFrame(() => computePop(view))
        }
      }),
      EditorView.domEventHandlers({
        mousedown: () => {
          // CodeMirror 的命令式事件回调需要渲染作用域外的标记，避免拖拽选词时反复弹出浮层
          // eslint-disable-next-line react-hooks/globals
          dragging = true
          setPop(null)
        },
        mouseup: (_e, view) => {
          // eslint-disable-next-line react-hooks/globals
          dragging = false
          requestAnimationFrame(() => computePop(view))
        },
      }),
    ]
  }, [])

  useEffect(() => {
    return () => {
      editorBridge.set(null)
      useCopilotStore.getState().setSelection(null)
    }
  }, [])

  const run = (action: SelectionAction) => {
    setPop(null)
    void useCopilotStore.getState().runSelection(action)
  }

  return (
    <div className="h-full w-full">
      <CodeMirror
        value={content}
        height="100%"
        theme="none"
        extensions={extensions}
        placeholder="在这里编辑 Markdown 正文…"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          dropCursor: true,
          indentOnInput: false,
          autocompletion: false,
          bracketMatching: false,
          closeBrackets: false,
        }}
        onChange={(v) => setContent(v)}
        onCreateEditor={(view) => {
          editorBridge.set(view)
          view.scrollDOM.addEventListener('scroll', () => setPop(null), { passive: true })
        }}
      />

      {pop &&
        createPortal(
          <div
            style={{ top: pop.top, left: pop.left }}
            onMouseDown={(e) => e.preventDefault()}
            className="fixed z-[60] flex animate-fade-in items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-pop"
          >
            <span className="flex items-center gap-1 px-1.5 text-[11px] font-medium text-accent">
              <Bot className="h-3.5 w-3.5" />
              AI
            </span>
            {QUICK.map(({ action, label, icon: Icon }) => (
              <button
                key={action}
                onClick={() => run(action)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-accent/10 hover:text-accent"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
            <button
              onClick={() => {
                setPop(null)
                useUiStore.getState().setRightOpen(true)
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-subtle transition-colors hover:bg-sunken hover:text-foreground"
            >
              <Eraser className="h-3.5 w-3.5" />
              更多…
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}

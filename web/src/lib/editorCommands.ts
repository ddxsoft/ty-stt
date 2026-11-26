import { EditorView } from '@codemirror/view'
import type { ChangeSpec } from '@codemirror/state'
import { redo, undo } from '@codemirror/commands'
import { TABLE_TEMPLATE } from './markdown'

/** 包裹选区（再次触发则取消包裹） */
export function wrapSelection(view: EditorView, before: string, after = before, placeholder = '文本') {
  const { from, to } = view.state.selection.main
  const sel = view.state.sliceDoc(from, to)
  const ob = view.state.sliceDoc(Math.max(0, from - before.length), from)
  const oa = view.state.sliceDoc(to, to + after.length)
  if (sel && ob === before && oa === after) {
    view.dispatch({
      changes: [
        { from: from - before.length, to: from, insert: '' },
        { from: to, to: to + after.length, insert: '' },
      ],
      selection: { anchor: from - before.length, head: to - before.length },
    })
  } else {
    const text = sel || placeholder
    view.dispatch({
      changes: { from, to, insert: before + text + after },
      selection: { anchor: from + before.length, head: from + before.length + text.length },
    })
  }
  view.focus()
}

interface LinePrefixOpts {
  /** 匹配已有前缀 */
  match: RegExp
  /** 第 i 行（从 0 开始）的前缀 */
  prefix: (i: number) => string
}

/** 切换行首前缀：所有行都已有则移除，否则统一替换/添加 */
export function toggleLinePrefix(view: EditorView, { match, prefix }: LinePrefixOpts) {
  const { state } = view
  const { from, to } = state.selection.main
  const first = state.doc.lineAt(from).number
  const last = state.doc.lineAt(to).number
  const lines = []
  for (let n = first; n <= last; n++) lines.push(state.doc.line(n))
  const allHave = lines.every((l, i) => l.text.startsWith(prefix(i)))
  const changes: ChangeSpec[] = lines.map((l, i) => {
    const m = l.text.match(match)
    const existing = m ? m[0].length : 0
    return {
      from: l.from,
      to: l.from + existing,
      insert: allHave ? '' : prefix(i),
    }
  })
  view.dispatch({ changes })
  view.focus()
}

export function setHeading(view: EditorView, level: number) {
  toggleLinePrefix(view, { match: /^#{1,6}\s+/, prefix: () => `${'#'.repeat(level)} ` })
}

export const toggleBulletList = (view: EditorView) =>
  toggleLinePrefix(view, { match: /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, prefix: () => '- ' })

export const toggleOrderedList = (view: EditorView) =>
  toggleLinePrefix(view, { match: /^\s*(?:[-*+]|\d+\.)\s+/, prefix: (i) => `${i + 1}. ` })

export const toggleQuote = (view: EditorView) =>
  toggleLinePrefix(view, { match: /^>\s?/, prefix: () => '> ' })

/** 在光标处插入独立块（前后保证空行） */
export function insertBlock(view: EditorView, text: string) {
  const { state } = view
  const { from, to } = state.selection.main
  const line = state.doc.lineAt(from)
  const atLineStart = from === line.from
  const prefix = line.text.length === 0 && atLineStart ? '' : '\n\n'
  const insert = `${prefix}${text}\n\n`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  })
  view.focus()
}

export const insertTable = (view: EditorView) => insertBlock(view, TABLE_TEMPLATE)
export const insertHr = (view: EditorView) => insertBlock(view, '---')

export function insertLink(view: EditorView) {
  const { from, to } = view.state.selection.main
  const sel = view.state.sliceDoc(from, to) || '链接文字'
  const insert = `[${sel}](https://)`
  const urlStart = from + sel.length + 3
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: urlStart, head: urlStart + 8 },
  })
  view.focus()
}

export function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
  view.focus()
}

export function doUndo(view: EditorView) {
  undo(view)
  view.focus()
}
export function doRedo(view: EditorView) {
  redo(view)
  view.focus()
}

/** 滚动到指定行（1-based）并移动光标 */
export function scrollToLine(view: EditorView, line: number) {
  const ln = Math.min(Math.max(1, line), view.state.doc.lines)
  const pos = view.state.doc.line(ln).from
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 12 }),
  })
}

import type { EditorView } from '@codemirror/view'

/**
 * 编辑器实例桥接：工具栏 / 大纲 / AI 助手需要操作当前 CodeMirror 视图。
 */
let current: EditorView | null = null

export const editorBridge = {
  set(view: EditorView | null) {
    current = view
  },
  get(): EditorView | null {
    return current
  },
}

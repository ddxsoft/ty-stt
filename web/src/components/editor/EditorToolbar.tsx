import { useDeferredValue, useMemo } from 'react'
import {
  Bold,
  Code,
  Heading,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTree,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
  Columns2,
  Eye,
  FileCode2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Menu } from '@/components/ui/Menu'
import { Segmented } from '@/components/ui/Primitives'
import { editorBridge } from '@/lib/editorBridge'
import { countWords } from '@/lib/format'
import * as cmd from '@/lib/editorCommands'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import type { EditorView } from '@codemirror/view'

function TB({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-sunken hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}

const Sep = () => <span className="mx-1 h-4 w-px bg-line" />

export default function EditorToolbar() {
  const mode = useUiStore((s) => s.editorMode)
  const setMode = useUiStore((s) => s.setEditorMode)
  const outlineOpen = useUiStore((s) => s.outlineOpen)
  const setOutlineOpen = useUiStore((s) => s.setOutlineOpen)
  const content = useDocStore((s) => s.content)
  const deferred = useDeferredValue(content)
  const words = useMemo(() => countWords(deferred), [deferred])
  const disabled = mode === 'preview'

  const run = (fn: (v: EditorView) => void) => () => {
    const v = editorBridge.get()
    if (v) fn(v)
  }

  return (
    <div className="flex shrink-0 items-center border-b border-line bg-surface/70 px-3 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
      <TB title="撤销 (Ctrl+Z)" disabled={disabled} onClick={run(cmd.doUndo)}>
        <Undo2 className="h-4 w-4" />
      </TB>
      <TB title="重做 (Ctrl+Y)" disabled={disabled} onClick={run(cmd.doRedo)}>
        <Redo2 className="h-4 w-4" />
      </TB>
      <Sep />
      <Menu
        trigger={() => (
          <button
            title="标题"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            className="flex h-8 items-center gap-0.5 rounded-lg px-2 text-subtle transition-colors hover:bg-sunken hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
          >
            <Heading className="h-4 w-4" />
          </button>
        )}
        items={[1, 2, 3, 4].map((l) => ({
          label: `${l} 级标题`,
          icon: <span className="font-mono text-[11px] font-bold">H{l}</span>,
          onClick: run((v) => cmd.setHeading(v, l)),
        }))}
      />
      <TB title="加粗 (Ctrl+B)" disabled={disabled} onClick={run((v) => cmd.wrapSelection(v, '**'))}>
        <Bold className="h-4 w-4" />
      </TB>
      <TB title="斜体" disabled={disabled} onClick={run((v) => cmd.wrapSelection(v, '*'))}>
        <Italic className="h-4 w-4" />
      </TB>
      <TB title="删除线" disabled={disabled} onClick={run((v) => cmd.wrapSelection(v, '~~'))}>
        <Strikethrough className="h-4 w-4" />
      </TB>
      <TB title="行内代码" disabled={disabled} onClick={run((v) => cmd.wrapSelection(v, '`', '`', 'code'))}>
        <Code className="h-4 w-4" />
      </TB>
      <Sep />
      <TB title="无序列表" disabled={disabled} onClick={run(cmd.toggleBulletList)}>
        <List className="h-4 w-4" />
      </TB>
      <TB title="有序列表" disabled={disabled} onClick={run(cmd.toggleOrderedList)}>
        <ListOrdered className="h-4 w-4" />
      </TB>
      <TB title="引用" disabled={disabled} onClick={run(cmd.toggleQuote)}>
        <Quote className="h-4 w-4" />
      </TB>
      <TB title="插入表格" disabled={disabled} onClick={run(cmd.insertTable)}>
        <Table2 className="h-4 w-4" />
      </TB>
      <TB title="分割线" disabled={disabled} onClick={run(cmd.insertHr)}>
        <Minus className="h-4 w-4" />
      </TB>
      <TB title="链接" disabled={disabled} onClick={run(cmd.insertLink)}>
        <Link2 className="h-4 w-4" />
      </TB>

      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3 pl-3">
        <span className="hidden whitespace-nowrap font-mono text-[11px] tabular-nums text-faint md:inline">
          {words.toLocaleString()} 字
        </span>
        <button
          onClick={() => setOutlineOpen(!outlineOpen)}
          title="大纲导航"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs transition-colors',
            outlineOpen ? 'bg-accent/10 text-accent' : 'text-subtle hover:bg-sunken hover:text-foreground',
          )}
        >
          <ListTree className="h-4 w-4" />
          <span className="hidden xl:inline">大纲</span>
        </button>
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'source', label: <><FileCode2 className="h-3.5 w-3.5" />源码</> },
            { value: 'split', label: <><Columns2 className="h-3.5 w-3.5" />分屏</> },
            { value: 'preview', label: <><Eye className="h-3.5 w-3.5" />预览</> },
          ]}
        />
      </div>
    </div>
  )
}

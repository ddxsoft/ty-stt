import { useMemo } from 'react'
import { cn } from '@/utils/cn'
import { extractOutline } from '@/lib/markdown'
import { editorBridge } from '@/lib/editorBridge'
import { scrollToLine } from '@/lib/editorCommands'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { ListTree } from 'lucide-react'

export default function Outline({ previewRef }: { previewRef: React.RefObject<HTMLDivElement | null> }) {
  const content = useDocStore((s) => s.content)
  const mode = useUiStore((s) => s.editorMode)
  const items = useMemo(() => extractOutline(content), [content])
  const minLevel = items.reduce((m, i) => Math.min(m, i.level), 6)

  const go = (line: number) => {
    if (mode !== 'preview') {
      const v = editorBridge.get()
      if (v) scrollToLine(v, line)
    }
    if (mode !== 'source') {
      const el = previewRef.current?.querySelector<HTMLElement>(`[data-line="${line}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-l border-line bg-sidebar/60">
      <div className="flex items-center gap-1.5 px-4 pb-2 pt-3 section-title">
        <ListTree className="h-3.5 w-3.5" />
        大纲
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {items.length === 0 ? (
          <p className="px-2 py-4 text-xs leading-relaxed text-faint">
            还没有标题。使用 <span className="kbd"># 标题</span> 语法或工具栏的「标题」按钮来生成大纲。
          </p>
        ) : (
          items.map((it, i) => (
            <button
              key={`${it.line}-${i}`}
              onClick={() => go(it.line)}
              style={{ paddingLeft: 8 + (it.level - minLevel) * 12 }}
              className={cn(
                'block w-full truncate rounded-md py-1 pr-2 text-left text-[12.5px] transition-colors hover:bg-sunken hover:text-accent',
                it.level === minLevel ? 'font-medium text-foreground' : 'text-subtle',
              )}
              title={it.text}
            >
              {it.text}
            </button>
          ))
        )}
      </nav>
    </aside>
  )
}

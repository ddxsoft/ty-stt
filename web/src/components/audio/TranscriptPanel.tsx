import { useEffect, useMemo, useRef } from 'react'
import { ChevronUp, Copy, CornerDownLeft, FileAudio2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { editorBridge } from '@/lib/editorBridge'
import { insertAtCursor } from '@/lib/editorCommands'
import { formatMs } from '@/lib/format'
import { useDocStore } from '@/store/docStore'
import { usePlayerStore } from '@/store/playerStore'
import { useToastStore } from '@/store/toastStore'
import { useUiStore } from '@/store/uiStore'
import type { Segment } from '@/api/types'

function findActive(segs: Segment[], ms: number): number {
  let lo = 0
  let hi = segs.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segs[mid].start_ms <= ms) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (ans >= 0 && ms > segs[ans].end_ms + 800) return -1
  return ans
}

export default function TranscriptPanel() {
  const doc = useDocStore((s) => s.doc)
  const open = useUiStore((s) => s.transcriptOpen)
  const setOpen = useUiStore((s) => s.setTranscriptOpen)
  const segments = useMemo(() => doc?.segments ?? [], [doc?.segments])
  const hasAudio = !!doc?.has_audio
  const active = usePlayerStore((s) => (hasAudio && open ? findActive(segments, s.currentMs) : -1))
  const playing = usePlayerStore((s) => s.playing)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || active < 0 || !playing) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-seg="${active}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active, open, playing])

  if (!doc || (segments.length === 0 && !doc.raw_transcript)) return null

  const copyAll = async () => {
    const text = segments.length ? segments.map((s) => s.text).join('\n') : doc.raw_transcript
    try {
      await navigator.clipboard.writeText(text)
      useToastStore.getState().success('已复制原始逐字稿')
    } catch {
      useToastStore.getState().error('复制失败', '浏览器拒绝访问剪贴板')
    }
  }

  const insert = (text: string) => {
    const v = editorBridge.get()
    if (!v) {
      useToastStore.getState().warning('请切换到「源码」或「分屏」模式后再插入')
      return
    }
    insertAtCursor(v, text)
  }

  return (
    <section className="shrink-0 border-t border-line bg-sidebar/60">
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <ChevronUp className={cn('h-4 w-4 text-faint transition-transform', !open && 'rotate-180')} />
          <FileAudio2 className="h-4 w-4 text-accent" />
          原始逐字稿
          <span className="font-normal text-faint">
            {segments.length > 0 ? `${segments.length} 段` : '纯文本'}
            {hasAudio && segments.length > 0 ? ' · 点击句子跳转音频' : ''}
          </span>
        </button>
        {open && (
          <button onClick={() => void copyAll()} className="flex items-center gap-1 text-xs text-faint hover:text-accent">
            <Copy className="h-3.5 w-3.5" />
            复制全文
          </button>
        )}
      </div>

      {open && (
        <div ref={listRef} className="h-56 overflow-y-auto px-2 pb-2">
          {segments.length === 0 ? (
            <p className="whitespace-pre-wrap px-3 py-1 text-[13px] leading-7 text-subtle">{doc.raw_transcript}</p>
          ) : (
            segments.map((s, i) => (
              <div
                key={s.id}
                data-seg={i}
                role="button"
                tabIndex={0}
                onClick={() => hasAudio && usePlayerStore.getState().seekMs(s.start_ms, true)}
                onKeyDown={(e) => e.key === 'Enter' && hasAudio && usePlayerStore.getState().seekMs(s.start_ms, true)}
                className={cn(
                  'group flex items-start gap-3 rounded-lg px-3 py-1.5 transition-colors',
                  hasAudio && 'cursor-pointer',
                  i === active ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-sunken',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 w-12 shrink-0 font-mono text-[11px] tabular-nums',
                    i === active ? 'font-semibold text-accent' : 'text-faint',
                  )}
                >
                  {formatMs(s.start_ms)}
                </span>
                <p className={cn('min-w-0 flex-1 text-[13px] leading-6', i === active ? 'text-foreground' : 'text-subtle')}>
                  {s.text}
                </p>
                <button
                  title="插入到编辑器光标处"
                  onClick={(e) => {
                    e.stopPropagation()
                    insert(s.text)
                  }}
                  className="mt-0.5 shrink-0 rounded p-1 text-faint opacity-0 transition-opacity hover:bg-surface hover:text-accent group-hover:opacity-100"
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}

import { useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useTaskStore } from '@/store/taskStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { TASK_STATUS_LABEL, isTaskActive } from '@/lib/format'
import type { Task } from '@/api/types'

function TaskCard({ task }: { task: Task }) {
  const live = useTaskStore((s) => s.live[task.task_id])
  const { cancel, retry, dismiss } = useTaskStore.getState()
  const open = (id: string) => {
    void useDocStore.getState().open(id)
    useUiStore.getState().setLeftOpen(false)
  }
  const active = isTaskActive(task)
  const liveText =
    task.status === 'polishing' && live?.delta
      ? live.delta
      : task.status === 'transcribing' && live?.segments.length
        ? live.segments[live.segments.length - 1]
        : ''
  const progress = Math.max(0, Math.min(100, task.progress))

  return (
    <div className="group relative rounded-xl border border-line bg-surface p-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
            active && 'bg-accent/10 text-accent',
            task.status === 'completed' && 'bg-success/10 text-success',
            (task.status === 'failed' || task.status === 'cancelled') && 'bg-danger/10 text-danger',
          )}
        >
          {active ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : task.status === 'completed' ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-5 text-foreground" title={task.filename}>
            {task.filename}
          </p>
          <p className="truncate text-[11px] text-faint">
            {TASK_STATUS_LABEL[task.status]}
            {active && task.stage_message ? ` · ${task.stage_message}` : ''}
            {!active && task.error ? ` · ${task.error}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {active && (
            <button
              onClick={() => void cancel(task.task_id)}
              title="取消任务"
              className="rounded-md p-1 text-faint hover:bg-sunken hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {(task.status === 'failed' || task.status === 'cancelled') && (
            <button
              onClick={() => void retry(task.task_id)}
              title="重试"
              className="rounded-md p-1 text-faint hover:bg-sunken hover:text-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {!active && (
            <button
              onClick={() => void dismiss(task.task_id)}
              title="清除记录"
              className="rounded-md p-1 text-faint opacity-0 hover:bg-sunken hover:text-danger group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {active && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
            <div
              className={cn(
                'h-full rounded-full bg-accent transition-[width] duration-500',
                progress < 5 && 'animate-pulse',
              )}
              style={{ width: `${Math.max(progress, 3)}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-[10px] tabular-nums text-faint">
            {Math.round(progress)}%
          </span>
        </div>
      )}

      {liveText && (
        <p className="mt-1.5 line-clamp-2 rounded-lg bg-sunken px-2 py-1 text-[11px] leading-snug text-subtle">
          {liveText}
          <span className="ml-0.5 inline-block h-3 w-px animate-blink bg-accent align-middle" />
        </p>
      )}

      {task.status === 'completed' && task.doc_id && (
        <button
          onClick={() => open(task.doc_id as string)}
          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
        >
          <FileText className="h-3 w-3" />
          打开文稿
        </button>
      )}
    </div>
  )
}

export default function TaskQueue() {
  const tasks = useTaskStore((s) => s.tasks)
  const mode = useTaskStore((s) => s.mode)
  const clearFinished = useTaskStore((s) => s.clearFinished)
  const [collapsed, setCollapsed] = useState(false)
  const [showAll, setShowAll] = useState(false)

  if (tasks.length === 0) return null

  const active = tasks.filter(isTaskActive)
  const finished = tasks.filter((t) => !isTaskActive(t))
  const finishedShown = showAll ? finished : finished.slice(0, 3)

  return (
    <section className="shrink-0 px-3 pb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 section-title hover:text-subtle"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', collapsed && '-rotate-90')} />
          任务队列
          {active.length > 0 && (
            <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-foreground">
              {active.length}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <span
            title={mode === 'sse' ? '实时连接' : mode === 'polling' ? '轮询模式（实时连接已断开）' : '连接中…'}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              mode === 'sse' ? 'bg-success' : mode === 'polling' ? 'bg-warning' : 'bg-faint',
            )}
          />
          {finished.length > 0 && (
            <button
              onClick={() => void clearFinished()}
              className="text-[11px] text-faint hover:text-danger"
            >
              清除已完成
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="flex max-h-[34vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {active.map((t) => (
            <TaskCard key={t.task_id} task={t} />
          ))}
          {finishedShown.map((t) => (
            <TaskCard key={t.task_id} task={t} />
          ))}
          {finished.length > 3 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="py-1 text-center text-[11px] text-faint hover:text-subtle"
            >
              {showAll ? '收起' : `显示全部 ${finished.length} 条已结束任务`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

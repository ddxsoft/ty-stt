import { create } from 'zustand'
import { cancelTask, deleteTask, listTasks, retryTask, TASK_STREAM_URL } from '@/api/transcriptions'
import { getErrorMessage } from '@/api/client'
import type { Task, TaskDeltaEvent, TaskSegmentEvent } from '@/api/types'
import { isTaskActive } from '@/lib/format'
import { useDocStore } from './docStore'
import { useLibraryStore } from './libraryStore'
import { useToastStore } from './toastStore'

export type StreamMode = 'connecting' | 'sse' | 'polling'

interface LiveInfo {
  /** 最近几段 STT 文本 */
  segments: string[]
  /** LLM 润色流式文本（尾部） */
  delta: string
}

interface TaskState {
  tasks: Task[]
  live: Record<string, LiveInfo>
  mode: StreamMode

  upsert: (t: Task) => void
  upsertMany: (ts: Task[]) => void
  sync: () => Promise<void>
  start: () => () => void
  cancel: (id: string) => Promise<void>
  retry: (id: string) => Promise<void>
  dismiss: (id: string) => Promise<void>
  clearFinished: () => Promise<void>
}

const DELTA_TAIL = 240
const SEG_KEEP = 3

function notifyCompleted(t: Task) {
  const toast = useToastStore.getState()
  void useLibraryStore.getState().refreshAll()
  if (t.doc_id) {
    const id = t.doc_id
    toast.success('转写完成', t.filename, {
      duration: 9000,
      action: {
        label: '打开文稿',
        onClick: () => void useDocStore.getState().open(id),
      },
    })
  } else {
    toast.success('转写完成', t.filename)
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  live: {},
  mode: 'connecting',

  upsert: (t) => {
    const prev = get().tasks.find((x) => x.task_id === t.task_id)
    set((s) => {
      const exists = s.tasks.some((x) => x.task_id === t.task_id)
      const tasks = exists
        ? s.tasks.map((x) => (x.task_id === t.task_id ? t : x))
        : [t, ...s.tasks]
      let live = s.live
      if (!isTaskActive(t) && live[t.task_id]) {
        live = { ...live }
        delete live[t.task_id]
      }
      return { tasks, live }
    })
    if (prev && isTaskActive(prev) && !isTaskActive(t)) {
      if (t.status === 'completed') notifyCompleted(t)
      else if (t.status === 'failed') {
        useToastStore.getState().error(`转写失败：${t.filename}`, t.error ?? undefined)
      }
    }
  },

  upsertMany: (ts) => {
    for (const t of [...ts].reverse()) get().upsert(t)
  },

  sync: async () => {
    try {
      const list = await listTasks()
      const prev = get().tasks
      // 以服务端为准替换，同时检测完成状态变化
      const prevMap = new Map(prev.map((t) => [t.task_id, t]))
      set((s) => ({
        tasks: list,
        live: Object.fromEntries(
          Object.entries(s.live).filter(([id]) => list.some((t) => t.task_id === id && isTaskActive(t))),
        ),
      }))
      for (const t of list) {
        const p = prevMap.get(t.task_id)
        if (p && isTaskActive(p) && !isTaskActive(t)) {
          if (t.status === 'completed') notifyCompleted(t)
          else if (t.status === 'failed') {
            useToastStore.getState().error(`转写失败：${t.filename}`, t.error ?? undefined)
          }
        }
      }
    } catch {
      /* 后端未就绪：保持现状 */
    }
  },

  start: () => {
    let es: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    let stopped = false

    const stopPolling = () => {
      if (poll) {
        clearInterval(poll)
        poll = null
      }
    }
    const startPolling = () => {
      if (poll || stopped) return
      set({ mode: 'polling' })
      poll = setInterval(() => void get().sync(), 3000)
    }

    const parse = <T,>(e: MessageEvent): T | null => {
      try {
        return JSON.parse(e.data as string) as T
      } catch {
        return null
      }
    }

    const connect = () => {
      if (typeof EventSource === 'undefined') {
        startPolling()
        return
      }
      es = new EventSource(TASK_STREAM_URL)
      es.onopen = () => {
        stopPolling()
        set({ mode: 'sse' })
        void get().sync()
      }
      es.onerror = () => {
        // EventSource 会自动重连；期间使用轮询兜底
        startPolling()
      }
      es.addEventListener('task', (e) => {
        const t = parse<Task>(e as MessageEvent)
        if (t) get().upsert(t)
      })
      es.addEventListener('segment', (e) => {
        const d = parse<TaskSegmentEvent>(e as MessageEvent)
        if (!d) return
        set((s) => {
          const cur = s.live[d.task_id] ?? { segments: [], delta: '' }
          return {
            live: {
              ...s.live,
              [d.task_id]: { ...cur, segments: [...cur.segments, d.text].slice(-SEG_KEEP) },
            },
          }
        })
      })
      es.addEventListener('delta', (e) => {
        const d = parse<TaskDeltaEvent>(e as MessageEvent)
        if (!d) return
        set((s) => {
          const cur = s.live[d.task_id] ?? { segments: [], delta: '' }
          return {
            live: {
              ...s.live,
              [d.task_id]: { ...cur, delta: (cur.delta + d.text).slice(-DELTA_TAIL) },
            },
          }
        })
      })
    }

    void get().sync()
    connect()

    return () => {
      stopped = true
      stopPolling()
      es?.close()
    }
  },

  cancel: async (id) => {
    try {
      get().upsert(await cancelTask(id))
    } catch (e) {
      useToastStore.getState().error('取消失败', getErrorMessage(e))
    }
  },

  retry: async (id) => {
    try {
      get().upsert(await retryTask(id))
    } catch (e) {
      useToastStore.getState().error('重试失败', getErrorMessage(e))
    }
  },

  dismiss: async (id) => {
    try {
      await deleteTask(id)
      set((s) => ({ tasks: s.tasks.filter((t) => t.task_id !== id) }))
    } catch (e) {
      useToastStore.getState().error('清除失败', getErrorMessage(e))
    }
  },

  clearFinished: async () => {
    const finished = get().tasks.filter((t) => !isTaskActive(t))
    await Promise.all(finished.map((t) => get().dismiss(t.task_id)))
  },
}))

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import DocumentWorkspace from '@/components/editor/DocumentWorkspace'
import CopilotPanel from '@/components/copilot/CopilotPanel'
import DialogRouter from '@/components/dialogs/DialogRouter'
import { DialogHost } from '@/components/ui/DialogHost'
import { ToastHost } from '@/components/ui/Toast'
import { useUiStore } from '@/store/uiStore'
import { useConfigStore } from '@/store/configStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useTaskStore } from '@/store/taskStore'
import { useDocStore } from '@/store/docStore'
import { usePlayerStore } from '@/store/playerStore'

const RIGHT_MIN = 288
const RIGHT_MAX = 560
const RIGHT_DEFAULT = 344
const WIDTH_KEY = 'ty-stt-right-width'

function readRightWidth(): number {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY))
    if (Number.isFinite(v) && v >= RIGHT_MIN && v <= RIGHT_MAX) return v
  } catch {
    /* localStorage 不可用时使用默认值 */
  }
  return RIGHT_DEFAULT
}

/** 首屏引导：读取配置 / 文稿库 / 任务流 / 全局快捷键 */
function useBootstrap() {
  useEffect(() => {
    void useConfigStore.getState().loadAll()
    void useLibraryStore.getState().refreshAll()
    const stopTasks = useTaskStore.getState().start()
    const healthTimer = setInterval(() => void useConfigStore.getState().loadHealth(), 30_000)
    return () => {
      stopTasks()
      clearInterval(healthTimer)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void useDocStore.getState().save()
        return
      }
      if (!e.altKey) return
      if (e.code === 'Space') {
        e.preventDefault()
        usePlayerStore.getState().toggle()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        usePlayerStore.getState().skip(-3000)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        usePlayerStore.getState().skip(3000)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  useBootstrap()

  const leftOpen = useUiStore((s) => s.leftOpen)
  const setLeftOpen = useUiStore((s) => s.setLeftOpen)
  const rightOpen = useUiStore((s) => s.rightOpen)
  const [rightWidth, setRightWidth] = useState(readRightWidth)
  const drag = useRef<{ x: number; w: number } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(rightWidth))
    } catch {
      /* ignore */
    }
  }, [rightWidth])

  useEffect(() => {
    if (!leftOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLeftOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leftOpen, setLeftOpen])

  // 小屏首屏默认收起 AI 面板，避免遮挡工作区
  const setRightOpen = useUiStore((s) => s.setRightOpen)
  useEffect(() => {
    if (window.matchMedia('(max-width: 1279px)').matches && useUiStore.getState().rightOpen) {
      setRightOpen(false)
    }
  }, [setRightOpen])

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    drag.current = { x: e.clientX, w: rightWidth }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const move = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      setRightWidth(Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, d.w - (ev.clientX - d.x))))
    }
    const end = () => {
      drag.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      {/* 左侧文稿库（桌面固定栏） */}
      <div className="hidden h-full w-[304px] shrink-0 lg:block">
        <Sidebar />
      </div>

      {/* 左侧文稿库（移动端抽屉） */}
      {leftOpen && (
        <div className="fixed inset-0 z-[70] flex lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-foreground/35"
            onClick={() => setLeftOpen(false)}
          />
          <div className="relative flex h-full w-[86vw] max-w-[330px] animate-slide-up flex-col bg-sidebar shadow-pop">
            <button
              onClick={() => setLeftOpen(false)}
              aria-label="收起文稿库"
              className="absolute right-2 top-3 z-10 rounded-lg p-1.5 text-faint hover:bg-sunken hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}

      {/* 中栏：编辑器工作区 */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DocumentWorkspace />
      </main>

      {/* 右栏：AI 精修副驾驶（桌面为常驻栏，小屏为右侧抽屉） */}
      {rightOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] animate-fade-in bg-foreground/30 xl:hidden"
            onClick={() => setRightOpen(false)}
          />
          <div
            role="separator"
            aria-label="调整 AI 面板宽度"
            onPointerDown={startResize}
            onDoubleClick={() => setRightWidth(RIGHT_DEFAULT)}
            className="hidden w-1 shrink-0 cursor-col-resize bg-line/40 transition-colors hover:bg-accent/40 xl:block"
          />
          <div
            role="complementary"
            aria-label="AI 精修助手"
            className="fixed inset-y-0 right-0 z-[65] w-[min(360px,88vw)] shrink-0 animate-slide-up shadow-pop xl:static xl:z-auto xl:animate-none xl:shadow-none xl:w-[var(--copilot-w)]"
            style={{ '--copilot-w': `${rightWidth}px` } as CSSProperties}
          >
            <CopilotPanel />
          </div>
        </>
      )}

      <ToastHost />
      <DialogHost />
      <DialogRouter />
    </div>
  )
}

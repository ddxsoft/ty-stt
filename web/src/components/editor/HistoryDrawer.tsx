import { useEffect, useState } from 'react'
import { History, RotateCcw, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { EmptyState, Spinner } from '@/components/ui/Primitives'
import DiffView from '@/components/copilot/DiffView'
import { getSnapshot, listSnapshots, restoreSnapshot } from '@/api/documents'
import { getErrorMessage } from '@/api/client'
import type { Snapshot } from '@/api/types'
import { useDocStore } from '@/store/docStore'
import { useToastStore } from '@/store/toastStore'
import { useUiStore } from '@/store/uiStore'
import { confirmDialog } from '@/store/dialogStore'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/utils/cn'

const REASON: Record<string, string> = {
  manual: '手动保存',
  auto: '自动保存',
  autosave: '自动保存',
  save: '保存',
  polish: 'AI 润色',
  restore: '版本恢复',
  initial: '初始版本',
  transcribe: '转写生成',
  transcription: '转写生成',
}

function HistoryBody({ docId }: { docId: string }) {
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [snapContent, setSnapContent] = useState<string | null>(null)
  const [loadingSnap, setLoadingSnap] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const current = useDocStore((s) => s.content)

  useEffect(() => {
    let alive = true
    const load = async () => {
      // 先保存，确保当前内容已进入快照链
      await useDocStore.getState().save()
      try {
        const list = await listSnapshots(docId)
        if (alive) setSnaps(list)
      } catch (e) {
        if (alive) setSnaps([])
        useToastStore.getState().error('加载历史版本失败', getErrorMessage(e))
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [docId])

  const pick = async (id: string) => {
    setSelected(id)
    setSnapContent(null)
    setLoadingSnap(true)
    try {
      const r = await getSnapshot(docId, id)
      setSnapContent(r.content)
    } catch (e) {
      useToastStore.getState().error('读取版本失败', getErrorMessage(e))
    } finally {
      setLoadingSnap(false)
    }
  }

  const restore = async () => {
    if (!selected) return
    const ok = await confirmDialog({
      title: '恢复到此版本？',
      message: '当前内容会先被保存为一个历史版本，之后可以再恢复回来。',
      confirmText: '恢复',
    })
    if (!ok) return
    setRestoring(true)
    try {
      const d = await restoreSnapshot(docId, selected)
      useDocStore.getState().applyDetail(d)
      useToastStore.getState().success('已恢复历史版本')
      useUiStore.getState().setHistoryOpen(false)
    } catch (e) {
      useToastStore.getState().error('恢复失败', getErrorMessage(e))
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="max-h-[34%] shrink-0 overflow-y-auto border-b border-line px-2 py-2">
        {snaps === null ? (
          <div className="flex justify-center py-6 text-faint">
            <Spinner />
          </div>
        ) : snaps.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="暂无历史版本"
            description="保存修改后，系统会自动为之前的内容建立快照。"
            className="py-6"
          />
        ) : (
          snaps.map((s) => (
            <button
              key={s.snapshot_id}
              onClick={() => void pick(s.snapshot_id)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                selected === s.snapshot_id ? 'bg-accent/10' : 'hover:bg-sunken',
              )}
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">{formatDateTime(s.created_at)}</p>
                <p className="text-[11px] text-faint">{REASON[s.reason] ?? s.reason}</p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-faint">{s.char_count} 字</span>
            </button>
          ))
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!selected ? (
          <p className="px-2 py-8 text-center text-xs text-faint">选择一个版本，查看与当前内容的差异</p>
        ) : loadingSnap || snapContent === null ? (
          <div className="flex justify-center py-8 text-faint">
            <Spinner />
          </div>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-faint">以下为「当前内容 → 所选版本」的变化（绿色为恢复后将出现的内容）</p>
            <DiffView oldText={current} newText={snapContent} resultLabel="该版本" maxHeightClass="max-h-none" />
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <Button
          variant="primary"
          size="md"
          className="w-full"
          disabled={!selected || snapContent === null || restoring}
          onClick={() => void restore()}
        >
          {restoring ? <Spinner /> : <RotateCcw className="h-4 w-4" />}
          恢复此版本
        </Button>
      </div>
    </div>
  )
}

export default function HistoryDrawer({ docId }: { docId: string }) {
  const open = useUiStore((s) => s.historyOpen)
  const setOpen = useUiStore((s) => s.setHistoryOpen)

  if (!open) return null
  return (
    <motion.div
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-y-0 right-0 z-30 flex w-[min(460px,100%)] flex-col border-l border-line bg-surface shadow-pop"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2 font-serif text-base font-semibold">
          <History className="h-4 w-4 text-accent" />
          历史版本
        </h3>
        <button
          onClick={() => setOpen(false)}
          aria-label="关闭"
          className="rounded-lg p-1.5 text-faint hover:bg-sunken hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <HistoryBody key={docId} docId={docId} />
    </motion.div>
  )
}

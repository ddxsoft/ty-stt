import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  FileText,
  FolderInput,
  History,
  Loader2,
  MoreHorizontal,
  PanelRight,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Menu } from '@/components/ui/Menu'
import { Tag } from '@/components/ui/Primitives'
import { MobileMenuButton } from '@/components/layout/Sidebar'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { confirmDialog } from '@/store/dialogStore'
import { exportUrl } from '@/api/documents'
import { formatDateTime, formatDurationCn } from '@/lib/format'
import { folderLabel } from '@/lib/folders'

function SaveIndicator() {
  const state = useDocStore((s) => s.saveState)
  const savedAt = useDocStore((s) => s.savedAt)
  const save = useDocStore((s) => s.save)
  const [now, setNow] = useState(() => Date.now())

  // 让「x 秒前 / x 分钟前」提示周期性刷新
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  const secs = savedAt ? Math.floor((now - savedAt) / 1000) : 0

  if (state === 'saving')
    return (
      <span className="flex items-center gap-1.5 text-xs text-subtle">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        保存中…
      </span>
    )
  if (state === 'dirty')
    return (
      <span className="flex items-center gap-1.5 text-xs text-warning">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        未保存
      </span>
    )
  if (state === 'error')
    return (
      <button
        onClick={() => void save()}
        className="flex items-center gap-1.5 text-xs text-danger hover:underline"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        保存失败，点击重试
      </button>
    )
  return (
    <span className="flex items-center gap-1.5 text-xs text-faint">
      <Check className="h-3.5 w-3.5 text-success" />
      已保存{state === 'saved' && secs > 60 ? ` · ${Math.floor(secs / 60)} 分钟前` : ''}
    </span>
  )
}

function TagEditor() {
  const tags = useDocStore((s) => s.tags)
  const setTags = useDocStore((s) => s.setTags)
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')

  const commit = () => {
    const parts = value
      .split(/[,，、\s]+/)
      .map((x) => x.trim().replace(/^#/, ''))
      .filter(Boolean)
    if (parts.length) setTags(Array.from(new Set([...tags, ...parts])))
    setValue('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <Tag key={t} onRemove={() => setTags(tags.filter((x) => x !== t))} className="py-1 pl-2 text-xs">
          # {t}
        </Tag>
      ))}
      {adding ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              setValue('')
              setAdding(false)
            }
          }}
          placeholder="输入标签，回车确认"
          className="h-6 w-36 rounded-md border border-accent bg-surface px-2 text-xs outline-none"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex h-6 items-center gap-0.5 rounded-md border border-dashed border-line-strong px-1.5 text-xs text-faint transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-3 w-3" />
          {tags.length === 0 ? '添加标签' : ''}
        </button>
      )}
    </div>
  )
}

export default function DocHeader() {
  const doc = useDocStore((s) => s.doc)
  const title = useDocStore((s) => s.title)
  const setTitle = useDocStore((s) => s.setTitle)
  const rightOpen = useUiStore((s) => s.rightOpen)
  const setRightOpen = useUiStore((s) => s.setRightOpen)
  const historyOpen = useUiStore((s) => s.historyOpen)
  const setHistoryOpen = useUiStore((s) => s.setHistoryOpen)
  const openDialog = useUiStore((s) => s.openDialog)

  if (!doc) return null

  const doExport = async (fmt: 'md' | 'txt') => {
    const ds = useDocStore.getState()
    if (ds.dirty) await ds.save()
    const a = document.createElement('a')
    a.href = exportUrl(doc.doc_id, fmt)
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const doDelete = async () => {
    const ok = await confirmDialog({
      title: '删除这篇文稿？',
      message: `「${title || doc.title}」及其音频、历史版本将被永久删除，无法恢复。`,
      confirmText: '永久删除',
      danger: true,
    })
    if (ok) await useDocStore.getState().remove()
  }

  return (
    <header className="shrink-0 border-b border-line bg-surface/70 px-5 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <MobileMenuButton />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="未命名文稿"
          aria-label="文稿标题"
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 font-serif text-[22px] font-bold leading-tight text-foreground outline-none ring-accent/30 transition-shadow placeholder:text-faint focus:ring-2"
        />
        <SaveIndicator />
        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          title="历史版本"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs transition-colors',
            historyOpen ? 'bg-accent/10 text-accent' : 'text-subtle hover:bg-sunken hover:text-foreground',
          )}
        >
          <History className="h-4 w-4" />
          <span className="hidden lg:inline">历史</span>
        </button>
        <Menu
          align="right"
          trigger={() => (
            <button
              title="导出"
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-subtle transition-colors hover:bg-sunken hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              <span className="hidden lg:inline">导出</span>
            </button>
          )}
          items={[
            { label: '导出为 Markdown (.md)', icon: <FileText className="h-4 w-4" />, onClick: () => void doExport('md') },
            { label: '导出为纯文本 (.txt)', icon: <FileText className="h-4 w-4" />, onClick: () => void doExport('txt') },
          ]}
        />
        <Menu
          align="right"
          trigger={() => (
            <button
              title="更多操作"
              aria-label="更多操作"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-sunken hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
          items={[
            {
              label: '移动到文件夹…',
              icon: <FolderInput className="h-4 w-4" />,
              onClick: () => openDialog({ type: 'move', docId: doc.doc_id }),
            },
            { label: '删除文稿', icon: <Trash2 className="h-4 w-4" />, danger: true, divider: true, onClick: () => void doDelete() },
          ]}
        />
        <button
          onClick={() => setRightOpen(!rightOpen)}
          title={rightOpen ? '收起 AI 精修助手' : '展开 AI 精修助手'}
          aria-label="切换 AI 精修助手"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            rightOpen ? 'bg-accent/10 text-accent' : 'text-subtle hover:bg-sunken hover:text-foreground',
          )}
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
          <span title={doc.path} className="max-w-[260px] truncate">{folderLabel(doc.folder)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDateTime(doc.created_at)}
          </span>
          {doc.duration_seconds > 0 && <span>音频 {formatDurationCn(doc.duration_seconds)}</span>}
        </div>
        <TagEditor />
      </div>
    </header>
  )
}

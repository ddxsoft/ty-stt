import { AudioLines, FileAudio, FilePlus2, FileText, SearchX, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useLibraryStore } from '@/store/libraryStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { Button } from '@/components/ui/Button'
import { EmptyState, Tag } from '@/components/ui/Primitives'
import { formatDurationCn, relativeTime } from '@/lib/format'
import { folderLabel } from '@/lib/folders'
import { DOC_DRAG_TYPE } from '@/lib/dnd'

export default function DocumentList() {
  const documents = useLibraryStore((s) => s.documents)
  const loading = useLibraryStore((s) => s.loadingDocs)
  const loadedOnce = useLibraryStore((s) => s.loadedOnce)
  const query = useLibraryStore((s) => s.query)
  const tag = useLibraryStore((s) => s.tag)
  const folder = useLibraryStore((s) => s.currentFolder)
  const setTag = useLibraryStore((s) => s.setTag)
  const activeId = useDocStore((s) => s.docId)
  const openDialog = useUiStore((s) => s.openDialog)

  const select = (id: string) => {
    void useDocStore.getState().open(id)
    useUiStore.getState().setLeftOpen(false)
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 pb-1.5 pt-1">
        <span className="section-title truncate">
          {folder ? folderLabel(folder) : '全部文稿'} · {documents.length}
        </span>
        {tag && (
          <button
            onClick={() => setTag('')}
            className="flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent"
          >
            #{tag}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!loadedOnce && loading ? (
          <div className="space-y-2 px-1 pt-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[74px] animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          query || tag ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" />}
              title="没有找到匹配的文稿"
              description="换个关键词，或清除筛选条件试试。"
            />
          ) : (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title={folder ? '这个文件夹还是空的' : '还没有文稿'}
              description="上传音频或直接录音，转写结果会以 Markdown 文件保存到这里。"
              action={
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => openDialog({ type: 'new' })}
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  新建转写
                </Button>
              }
            />
          )
        ) : (
          <ul className={cn('space-y-0.5 transition-opacity', loading && 'opacity-70')}>
            {documents.map((d) => {
              const active = d.doc_id === activeId
              return (
                <li key={d.doc_id}>
                  <div
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DOC_DRAG_TYPE, d.doc_id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => select(d.doc_id)}
                    onKeyDown={(e) => e.key === 'Enter' && select(d.doc_id)}
                    className={cn(
                      'group relative cursor-pointer rounded-xl px-3 py-2.5 transition-colors',
                      active
                        ? 'bg-surface shadow-soft ring-1 ring-line-strong'
                        : 'hover:bg-sunken/80',
                    )}
                  >
                    {active && (
                      <span className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r bg-accent" />
                    )}
                    <div className="flex items-start gap-2">
                      <h3
                        className={cn(
                          'min-w-0 flex-1 truncate text-[13.5px] font-medium leading-5',
                          active ? 'text-foreground' : 'text-foreground/90',
                        )}
                      >
                        {d.title || '未命名文稿'}
                      </h3>
                      {d.has_audio && (
                        <AudioLines className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/80" aria-label="含音频" />
                      )}
                    </div>
                    {d.snippet && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.45] text-faint">
                        {d.snippet}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-faint">
                      <span>{relativeTime(d.updated_at)}</span>
                      {d.duration_seconds > 0 && (
                        <span className="flex items-center gap-0.5">
                          <FileAudio className="h-3 w-3" />
                          {formatDurationCn(d.duration_seconds)}
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden">
                        {d.tags.slice(0, 2).map((t) => (
                          <Tag key={t} onClick={() => setTag(t)} className="max-w-[72px] truncate">
                            {t}
                          </Tag>
                        ))}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

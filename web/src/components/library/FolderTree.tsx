import { useState } from 'react'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Library,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { DOC_DRAG_TYPE } from '@/lib/dnd'
import { useLibraryStore } from '@/store/libraryStore'
import { useDocStore } from '@/store/docStore'
import { useToastStore } from '@/store/toastStore'
import { promptDialog, confirmDialog } from '@/store/dialogStore'
import { moveDocument } from '@/api/documents'
import { getErrorMessage } from '@/api/client'
import type { FolderNode } from '@/api/types'


function FolderRow({
  node,
  depth,
  expanded,
  toggle,
}: {
  node: FolderNode
  depth: number
  expanded: Set<string>
  toggle: (p: string) => void
}) {
  const current = useLibraryStore((s) => s.currentFolder)
  const setFolder = useLibraryStore((s) => s.setFolder)
  const [dropping, setDropping] = useState(false)
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.path)
  const active = current === node.path

  const onAdd = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const name = await promptDialog({
      title: `在「${node.name}」下新建文件夹`,
      label: '文件夹名称',
      placeholder: '例如：课程笔记',
      confirmText: '创建',
    })
    if (!name) return
    const ok = await useLibraryStore.getState().createFolder(`${node.path}/${name}`)
    if (ok && !isOpen) toggle(node.path)
  }
  const onRename = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const name = await promptDialog({
      title: '重命名文件夹',
      label: '新名称',
      initial: node.name,
      confirmText: '重命名',
    })
    if (name && name !== node.name) await useLibraryStore.getState().renameFolder(node.path, name)
  }
  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirmDialog({
      title: `删除文件夹「${node.name}」？`,
      message: '此操作不可撤销。若文件夹内有文稿，将再次向你确认。',
      confirmText: '删除',
      danger: true,
    })
    if (ok) await useLibraryStore.getState().deleteFolder(node.path)
  }

  const handleDrop = async (e: React.DragEvent) => {
    setDropping(false)
    const id = e.dataTransfer.getData(DOC_DRAG_TYPE)
    if (!id) return
    e.preventDefault()
    try {
      const ds = useDocStore.getState()
      if (ds.docId === id && ds.dirty) await ds.save()
      const d = await moveDocument(id, { folder: node.path })
      if (ds.docId === id) useDocStore.setState({ doc: d })
      void useLibraryStore.getState().refreshAll()
      useToastStore.getState().success('已移动', `「${d.title}」→ ${node.name}`)
    } catch (err) {
      useToastStore.getState().error('移动失败', getErrorMessage(err))
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFolder(node.path)}
        onKeyDown={(e) => e.key === 'Enter' && setFolder(node.path)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DOC_DRAG_TYPE)) {
            e.preventDefault()
            setDropping(true)
          }
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={handleDrop}
        style={{ paddingLeft: 6 + depth * 14 }}
        className={cn(
          'group flex h-8 cursor-pointer items-center gap-1 rounded-lg pr-1.5 text-[13px] transition-colors',
          active ? 'bg-accent/10 font-medium text-accent' : 'text-subtle hover:bg-sunken hover:text-foreground',
          dropping && 'bg-accent/15 ring-1 ring-accent',
        )}
      >
        <button
          aria-label={isOpen ? '折叠' : '展开'}
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) toggle(node.path)
          }}
          className={cn('flex h-5 w-5 items-center justify-center rounded', !hasChildren && 'invisible')}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')} />
        </button>
        {active || isOpen ? (
          <FolderOpen className="h-4 w-4 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button onClick={onAdd} title="新建子文件夹" className="rounded p-1 hover:bg-surface hover:text-foreground">
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button onClick={onRename} title="重命名" className="rounded p-1 hover:bg-surface hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} title="删除" className="rounded p-1 hover:bg-surface hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-faint group-hover:hidden">
          {node.doc_count || ''}
        </span>
      </div>
      {isOpen &&
        node.children.map((c) => (
          <FolderRow key={c.path} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} />
        ))}
    </>
  )
}

export default function FolderTree() {
  const folders = useLibraryStore((s) => s.folders)
  const current = useLibraryStore((s) => s.currentFolder)
  const setFolder = useLibraryStore((s) => s.setFolder)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dropping, setDropping] = useState(false)

  const toggle = (p: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })

  const newTop = async () => {
    const name = await promptDialog({
      title: '新建文件夹',
      label: '文件夹名称（可用 / 创建多级）',
      placeholder: '例如：课程笔记',
      confirmText: '创建',
    })
    if (name) await useLibraryStore.getState().createFolder(name)
  }

  const dropToRoot = async (e: React.DragEvent) => {
    setDropping(false)
    const id = e.dataTransfer.getData(DOC_DRAG_TYPE)
    if (!id) return
    e.preventDefault()
    try {
      const ds = useDocStore.getState()
      if (ds.docId === id && ds.dirty) await ds.save()
      const d = await moveDocument(id, { folder: '' })
      if (ds.docId === id) useDocStore.setState({ doc: d })
      void useLibraryStore.getState().refreshAll()
    } catch (err) {
      useToastStore.getState().error('移动失败', getErrorMessage(err))
    }
  }

  return (
    <section className="shrink-0 px-3 pb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="section-title">文件夹</span>
        <button
          onClick={() => void newTop()}
          title="新建文件夹"
          className="rounded-md p-1 text-faint hover:bg-sunken hover:text-foreground"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-[26vh] overflow-y-auto">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFolder('')}
          onKeyDown={(e) => e.key === 'Enter' && setFolder('')}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DOC_DRAG_TYPE)) {
              e.preventDefault()
              setDropping(true)
            }
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={dropToRoot}
          className={cn(
            'flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] transition-colors',
            current === '' ? 'bg-accent/10 font-medium text-accent' : 'text-subtle hover:bg-sunken hover:text-foreground',
            dropping && 'bg-accent/15 ring-1 ring-accent',
          )}
        >
          <Library className="h-4 w-4" />
          <span className="flex-1">全部文稿</span>
          <span className="font-mono text-[10px] tabular-nums text-faint">{folders?.doc_count || ''}</span>
        </div>
        {folders?.children.map((c) => (
          <FolderRow key={c.path} node={c} depth={0} expanded={expanded} toggle={toggle} />
        ))}
      </div>
    </section>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileAudio, Loader2, UploadCloud, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FolderSelect, PresetSelect } from './shared'
import { createTranscriptions } from '@/api/transcriptions'
import { getErrorMessage } from '@/api/client'
import { useConfigStore } from '@/store/configStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useTaskStore } from '@/store/taskStore'
import { useToastStore } from '@/store/toastStore'
import { useUiStore } from '@/store/uiStore'
import { formatBytes } from '@/lib/format'

const ACCEPT = '.mp3,.wav,.m4a,.webm,.flac,.ogg,.aac,.mp4'
const ALLOWED = ['mp3', 'wav', 'm4a', 'webm', 'flac', 'ogg', 'aac', 'mp4']

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export default function NewTranscriptionDialog({
  initialFiles,
  onClose,
}: {
  initialFiles?: File[]
  onClose: () => void
}) {
  const currentFolder = useLibraryStore((s) => s.currentFolder)
  const defaultPreset = useConfigStore((s) => s.settings?.default_preset ?? 'medium')
  const [files, setFiles] = useState<File[]>(initialFiles ?? [])
  const [folder, setFolder] = useState(currentFolder)
  const [preset, setPreset] = useState(defaultPreset)
  const [hotwords, setHotwords] = useState('')
  const [title, setTitle] = useState('')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFolder(currentFolder)
  }, [currentFolder])

  useEffect(() => {
    setPreset(defaultPreset)
  }, [defaultPreset])

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return
    const incoming = Array.from(list)
    const valid = incoming.filter((f) => ALLOWED.includes(extOf(f.name)))
    if (valid.length < incoming.length) {
      useToastStore.getState().warning('部分文件格式不支持', '仅支持 mp3 / wav / m4a / webm / flac / ogg / aac / mp4')
    }
    setFiles((prev) => [...prev, ...valid])
  }

  const remove = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const totalBytes = useMemo(() => files.reduce((n, f) => n + f.size, 0), [files])
  const uploading = progress !== null

  const submit = async () => {
    if (!files.length) return
    setProgress(0)
    try {
      const tasks = await createTranscriptions(
        files,
        { folder, preset, hotwords, title: files.length === 1 ? title : undefined },
        (pct) => setProgress(pct),
      )
      useTaskStore.getState().upsertMany(tasks)
      useToastStore.getState().success(
        `已提交 ${tasks.length} 个转写任务`,
        files.length > 1 ? '任务队列会依次处理，可继续编辑其他文稿' : undefined,
      )
      useUiStore.getState().closeDialog()
    } catch (e) {
      setProgress(null)
      useToastStore.getState().error('提交失败', getErrorMessage(e))
    }
  }

  return (
    <Modal
      open
      onClose={uploading ? () => undefined : onClose}
      title="新建转写"
      description="上传音频后，后台会依次完成转写与 AI 润色，并直接保存为 Markdown 文稿。"
      width="lg"
      footer={
        <>
          <span className="mr-auto text-[11px] text-faint">
            {files.length > 0 ? `${files.length} 个文件 · ${formatBytes(totalBytes)}` : '尚未选择文件'}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!files.length || uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? `上传中 ${progress}%` : '开始转写'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            addFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
            dragging ? 'border-accent bg-accent/10' : 'border-line-strong hover:border-accent/70 hover:bg-sunken/60',
          )}
        >
          <UploadCloud className="h-6 w-6 text-accent" />
          <p className="text-[13px] font-medium text-foreground">拖入音频文件，或点击选择</p>
          <p className="text-[11px] text-faint">支持 mp3 / wav / m4a / webm / flac / ogg / aac / mp4，可批量上传</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line bg-sunken/40 p-1.5">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                <FileAudio className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{f.name}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-faint">{formatBytes(f.size)}</span>
                <button
                  onClick={() => remove(i)}
                  title="移除"
                  className="shrink-0 rounded p-0.5 text-faint hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">目标文件夹</label>
            <FolderSelect value={folder} onChange={setFolder} />
          </div>
          <div>
            <label className="label">润色预设</label>
            <PresetSelect value={preset} onChange={setPreset} />
          </div>
        </div>

        <div>
          <label className="label">本次热词（可选，逗号分隔）</label>
          <input
            className="field"
            value={hotwords}
            onChange={(e) => setHotwords(e.target.value)}
            placeholder="例如：地变, 井卦, FastAPI"
          />
        </div>

        {files.length === 1 && (
          <div>
            <label className="label">文稿标题（可选，默认由音频名生成）</label>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：项目复盘会议" />
          </div>
        )}
      </div>
    </Modal>
  )
}

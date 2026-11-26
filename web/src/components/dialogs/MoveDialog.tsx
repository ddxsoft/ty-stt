import { useMemo, useState } from 'react'
import { FolderInput, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FolderSelect } from './shared'
import { useDocStore } from '@/store/docStore'

export default function MoveDialog({ docId, onClose }: { docId: string; onClose: () => void }) {
  const doc = useDocStore((s) => (s.doc?.doc_id === docId ? s.doc : null))
  const baseName = useMemo(() => {
    const name = doc?.path.split('/').pop() ?? ''
    return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name
  }, [doc?.path])
  const [folder, setFolder] = useState(() => doc?.folder ?? '')
  const [filename, setFilename] = useState(() => baseName)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    const nextName = filename.trim()
    const ok = await useDocStore.getState().move(folder, nextName && nextName !== baseName ? nextName : undefined)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={
        <span className="flex items-center gap-2">
          <FolderInput className="h-4 w-4 text-accent" />
          移动文稿
        </span>
      }
      description={doc ? `「${doc.title || '未命名文稿'}」当前位于 ${doc.folder || '根目录'}` : '正在读取文稿…'}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy || !doc}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            移动
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">目标文件夹</label>
          <FolderSelect value={folder} onChange={setFolder} rootLabel="根目录（不放入任何文件夹）" />
        </div>
        <div>
          <label className="label">文件名（不含 .md）</label>
          <input className="field" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder={baseName} />
          <p className="mt-1 text-[11px] text-faint">留空或保持不变则沿用原文件名；同名文件会自动追加序号。</p>
        </div>
      </div>
    </Modal>
  )
}

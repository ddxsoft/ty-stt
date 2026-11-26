import NewTranscriptionDialog from './NewTranscriptionDialog'
import RecordDialog from './RecordDialog'
import SettingsDialog from './SettingsDialog'
import MoveDialog from './MoveDialog'
import { useUiStore } from '@/store/uiStore'

/** 根据 uiStore.dialog 渲染对应弹窗（新建 / 录音 / 设置 / 移动） */
export default function DialogRouter() {
  const dialog = useUiStore((s) => s.dialog)
  const closeDialog = useUiStore((s) => s.closeDialog)

  if (!dialog) return null

  switch (dialog.type) {
    case 'new':
      return <NewTranscriptionDialog key="new" initialFiles={dialog.files} onClose={closeDialog} />
    case 'record':
      return <RecordDialog key="record" onClose={closeDialog} />
    case 'settings':
      return <SettingsDialog key={`settings-${dialog.tab ?? 'llm'}`} initialTab={dialog.tab} onClose={closeDialog} />
    case 'move':
      return <MoveDialog key={`move-${dialog.docId}`} docId={dialog.docId} onClose={closeDialog} />
  }
}

import { useRef } from 'react'
import { AudioLines, FilePlus2, Mic, Sparkles, FileText, ListChecks, UploadCloud } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Primitives'
import { MobileMenuButton, ThemeToggle } from '@/components/layout/Sidebar'
import DocHeader from './DocHeader'
import EditorToolbar from './EditorToolbar'
import MarkdownEditor from './MarkdownEditor'
import MarkdownPreview from './MarkdownPreview'
import Outline from './Outline'
import HistoryDrawer from './HistoryDrawer'
import TranscriptPanel from '@/components/audio/TranscriptPanel'
import AudioPlayer from '@/components/audio/AudioPlayer'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { useLibraryStore } from '@/store/libraryStore'

function Welcome() {
  const openDialog = useUiStore((s) => s.openDialog)
  const docCount = useLibraryStore((s) => s.documents.length)
  const steps = [
    { icon: UploadCloud, title: '上传或录音', desc: '拖入音频文件，或直接开始实时录音' },
    { icon: AudioLines, title: '语音转写', desc: '本地 STT 引擎逐句识别，进度实时可见' },
    { icon: Sparkles, title: 'AI 精修', desc: '大模型润色成结构清晰的 Markdown 文稿' },
    { icon: ListChecks, title: '对照校对', desc: '点击原始逐字稿即可跳转到对应音频位置' },
  ]
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-3 lg:hidden">
        <MobileMenuButton />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
        <div className="w-full max-w-2xl animate-slide-up">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            语音转文字 · AI 精修
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-[44px]">
            把声音，
            <br />
            整理成<span className="text-accent">好文章</span>。
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-subtle">
            上传会议、课程或访谈录音，太夷听写会转写并润色为 Markdown 文稿，保存在你本地的文件夹中。
            {docCount > 0 ? '从左侧选择一篇文稿继续编辑，' : ''}或者现在就开始。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="primary" size="md" className="h-11 px-6" onClick={() => openDialog({ type: 'new' })}>
              <FilePlus2 className="h-4 w-4" />
              新建转写
            </Button>
            <Button variant="outline" size="md" className="h-11 px-6" onClick={() => openDialog({ type: 'record' })}>
              <Mic className="h-4 w-4 text-accent" />
              实时录音
            </Button>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sunken text-accent">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    <span className="mr-1.5 font-mono text-xs text-faint">0{i + 1}</span>
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-faint">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 flex items-center gap-1.5 text-xs text-faint">
            <FileText className="h-3.5 w-3.5" />
            快捷键：<span className="kbd">Ctrl</span>+<span className="kbd">S</span> 保存 ·
            <span className="kbd">Alt</span>+<span className="kbd">空格</span> 播放/暂停 ·
            <span className="kbd">Alt</span>+<span className="kbd">←</span>
            <span className="kbd">→</span> 快退/快进 3 秒
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DocumentWorkspace() {
  const docId = useDocStore((s) => s.docId)
  const doc = useDocStore((s) => s.doc)
  const loading = useDocStore((s) => s.loading)
  const loadError = useDocStore((s) => s.loadError)
  const content = useDocStore((s) => s.content)
  const mode = useUiStore((s) => s.editorMode)
  const outlineOpen = useUiStore((s) => s.outlineOpen)
  const previewRef = useRef<HTMLDivElement>(null)

  if (!docId) return <Welcome />

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-danger">{loadError}</p>
        <Button size="sm" variant="outline" onClick={() => useDocStore.getState().close()}>
          返回
        </Button>
      </div>
    )
  }

  if (!doc || loading) {
    return (
      <div className="flex h-full items-center justify-center text-faint">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  const showEditor = mode !== 'preview'
  const showPreview = mode !== 'source'

  return (
    <div className="flex h-full min-w-0 flex-col">
      <DocHeader />
      <EditorToolbar />
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1">
          {showEditor && (
            <div
              className={cn(
                'h-full min-w-0 bg-surface/40',
                mode === 'split' ? 'w-1/2 border-r border-line' : 'flex-1',
              )}
            >
              <div className={cn('mx-auto h-full', mode === 'source' && 'max-w-[900px]')}>
                <MarkdownEditor key={docId} />
              </div>
            </div>
          )}
          {showPreview && (
            <div ref={previewRef} className={cn('h-full min-w-0 overflow-y-auto', mode === 'split' ? 'w-1/2' : 'flex-1')}>
              <div className={cn('mx-auto px-8 py-8', mode === 'split' ? 'max-w-[760px]' : 'max-w-[800px]')}>
                {content.trim() ? (
                  <MarkdownPreview content={content} />
                ) : (
                  <p className="py-16 text-center text-sm text-faint">正文为空，开始输入或使用 AI 精修生成内容</p>
                )}
              </div>
            </div>
          )}
        </div>
        {outlineOpen && <Outline previewRef={previewRef} />}
        <HistoryDrawer docId={docId} />
      </div>
      <TranscriptPanel />
      {doc.has_audio && <AudioPlayer docId={docId} fallbackSeconds={doc.duration_seconds} />}
    </div>
  )
}

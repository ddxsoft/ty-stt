import { useState } from 'react'
import {
  Bot,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Sparkles,
  Square,
  Tags,
  Wand2,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Primitives'
import { Menu } from '@/components/ui/Menu'
import DiffView from '@/components/copilot/DiffView'
import { useCopilotStore } from '@/store/copilotStore'
import { useConfigStore } from '@/store/configStore'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import type { Preset, SelectionAction } from '@/api/types'

const FALLBACK_PRESETS: Preset[] = [
  { id: 'none', name: '仅转写（不润色）', description: '直接生成原始逐字稿', builtin: true, system_prompt: '' },
  { id: 'light', name: '轻度纠错', description: '只改错别字与标点', builtin: true, system_prompt: '' },
  { id: 'medium', name: '中度润色（推荐）', description: '去口语词、理顺语序', builtin: true, system_prompt: '' },
  { id: 'heavy', name: '重度精修', description: '转为正式书面文稿', builtin: true, system_prompt: '' },
  { id: 'minutes', name: '结构化纪要', description: '摘要 + 分点论述', builtin: true, system_prompt: '' },
]

const SELECTION_ACTIONS: { action: SelectionAction; label: string }[] = [
  { action: 'polish', label: '润色通顺' },
  { action: 'fix', label: '修正错字' },
  { action: 'shorten', label: '精简压缩' },
  { action: 'list', label: '转为列表' },
  { action: 'table', label: '转为表格' },
  { action: 'formal', label: '书面化' },
  { action: 'verify', label: '对照原稿核对' },
]

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-foreground">
      <span className="text-accent">{icon}</span>
      {children}
    </div>
  )
}

function StreamingBox({ text, label }: { text: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-1.5 text-[11px] text-subtle">
        <Loader2 className="h-3 w-3 animate-spin text-accent" />
        {label}
      </div>
      <div className="max-h-[42vh] overflow-y-auto px-3 py-2">
        {text ? (
          <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.75] text-foreground">
            {text}
            <span className="ml-0.5 inline-block h-3.5 w-px animate-blink bg-accent align-middle" />
          </p>
        ) : (
          <p className="py-3 text-xs text-faint">正在思考…</p>
        )}
      </div>
    </div>
  )
}

function DocumentSection() {
  const preset = useCopilotStore((s) => s.preset)
  const setPreset = useCopilotStore((s) => s.setPreset)
  const source = useCopilotStore((s) => s.source)
  const setSource = useCopilotStore((s) => s.setSource)
  const docRun = useCopilotStore((s) => s.docRun)
  const presets = useConfigStore((s) => s.presets)

  const options = presets.length ? presets : FALLBACK_PRESETS
  const current = options.find((p) => p.id === preset) ?? options[0]
  const streaming = docRun?.status === 'streaming'
  const done = docRun?.status === 'done'

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-3">
      <SectionTitle icon={<Sparkles className="h-3.5 w-3.5" />}>全文润色</SectionTitle>

      <Menu
        className="w-full"
        menuClassName="w-[248px] max-h-[320px] overflow-y-auto"
        trigger={() => (
          <button className="flex w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-left text-[13px] text-foreground transition-colors hover:border-accent">
            <span className="min-w-0">
              <span className="block truncate font-medium">{current.name}</span>
              {current.description && (
                <span className="block truncate text-[11px] font-normal text-faint">{current.description}</span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
          </button>
        )}
        items={options.map((p) => ({
          label: p.name,
          active: p.id === preset,
          onClick: () => setPreset(p.id),
        }))}
      />

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[11px] text-faint">润色依据</span>
        <Segmented
          size="sm"
          value={source}
          onChange={setSource}
          options={[
            { value: 'transcript', label: '原始转写' },
            { value: 'current', label: '当前正文' },
          ]}
        />
      </div>

      <Button
        variant={streaming ? 'outline' : 'primary'}
        size="md"
        className="mt-3 w-full"
        disabled={streaming ? false : !useDocStore.getState().docId}
        onClick={() => {
          const store = useCopilotStore.getState()
          if (streaming) store.stopDocument()
          else void store.runDocument()
        }}
      >
        {streaming ? (
          <>
            <Square className="h-3.5 w-3.5" />
            停止生成
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            按此模式重新润色
          </>
        )}
      </Button>

      {streaming && docRun && <div className="mt-3"><StreamingBox text={docRun.text} label="正在润色全文…" /></div>}

      {docRun?.status === 'error' && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{docRun.error}</p>
      )}

      {done && docRun && (
        <div className="mt-3">
          <DiffView oldText={docRun.base} newText={docRun.text} resultLabel="新正文" maxHeightClass="max-h-[38vh]" />
          <div className="mt-2 flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={() => void useCopilotStore.getState().applyDocument()}>
              <Check className="h-3.5 w-3.5" />
              应用替换
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => useCopilotStore.getState().discardDocument()}>
              <X className="h-3.5 w-3.5" />
              放弃
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function SelectionSection() {
  const selection = useCopilotStore((s) => s.selection)
  const selRun = useCopilotStore((s) => s.selRun)
  const [instruction, setInstruction] = useState('')
  const streaming = selRun?.status === 'streaming'

  const run = (action?: SelectionAction) => {
    void useCopilotStore.getState().runSelection(action, instruction.trim() || undefined)
    setInstruction('')
  }

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-3">
      <SectionTitle icon={<Bot className="h-3.5 w-3.5" />}>划词精修</SectionTitle>

      {selection ? (
        <div className="rounded-lg border border-accent/40 bg-accent/5 px-2.5 py-2">
          <p className="line-clamp-3 text-[12.5px] leading-relaxed text-subtle">
            “{selection.text}”
          </p>
          <p className="mt-1 font-mono text-[10.5px] text-faint">{selection.text.length} 字符已选中</p>
        </div>
      ) : (
        <p className="rounded-lg bg-sunken px-3 py-2.5 text-[12px] leading-relaxed text-faint">
          在「源码 / 分屏」模式下选中一段文字，即可调用 AI 局部精修；结果以 Diff 形式预览，确认后才会替换。
        </p>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {SELECTION_ACTIONS.map(({ action, label }) => (
          <button
            key={action}
            disabled={!selection || streaming}
            onClick={() => run(action)}
            className={cn(
              'rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] text-foreground transition-colors',
              'hover:border-accent/60 hover:bg-accent/10 hover:text-accent',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-end gap-1.5">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          placeholder="自定义要求，例如：把这段改成更正式的书面语，并加一个小标题"
          className="field min-h-[56px] resize-y !py-1.5 text-[12.5px]"
        />
        <Button
          variant="soft"
          size="sm"
          className="h-[56px] shrink-0 px-2.5"
          disabled={!selection || streaming || !instruction.trim()}
          onClick={() => run()}
          title="按自定义要求改写选中内容"
        >
          <Wand2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {streaming && selRun && <div className="mt-3"><StreamingBox text={selRun.text} label="正在改写选中内容…" /></div>}

      {selRun?.status === 'error' && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{selRun.error}</p>
      )}

      {selRun?.status === 'done' && (
        <div className="mt-3">
          <DiffView oldText={selRun.original} newText={selRun.text} resultLabel="改写结果" maxHeightClass="max-h-[34vh]" />
          <div className="mt-2 flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={() => useCopilotStore.getState().applySelection()}>
              <Check className="h-3.5 w-3.5" />
              应用替换
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => useCopilotStore.getState().discardSelection()}>
              <X className="h-3.5 w-3.5" />
              放弃
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function TitleSection() {
  const loading = useCopilotStore((s) => s.titleLoading)
  const suggestion = useCopilotStore((s) => s.titleSuggestion)
  const content = useDocStore((s) => s.content)
  const title = useDocStore((s) => s.title)
  const tags = useDocStore((s) => s.tags)

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-3">
      <SectionTitle icon={<Tags className="h-3.5 w-3.5" />}>标题与标签</SectionTitle>
      <p className="mb-2 text-[12px] leading-relaxed text-faint">
        当前：<span className="text-subtle">{title || '未命名文稿'}</span>
        {tags.length > 0 && <span className="text-faint"> · #{tags.join(' #')}</span>}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={loading || !content.trim() || !useDocStore.getState().docId}
        onClick={() => void useCopilotStore.getState().suggestTitle()}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? '正在生成…' : '让 AI 生成标题与标签'}
      </Button>

      {suggestion && (
        <div className="mt-2 rounded-lg border border-line bg-surface p-2.5">
          <p className="text-[13px] font-medium text-foreground">{suggestion.title || '（未生成标题）'}</p>
          {suggestion.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggestion.tags.map((t) => (
                <span key={t} className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] text-subtle">
                  # {t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <Button variant="primary" size="xs" onClick={() => useCopilotStore.getState().applyTitleSuggestion()}>
              <Check className="h-3 w-3" />
              采用
            </Button>
            <Button variant="ghost" size="xs" onClick={() => useCopilotStore.getState().dismissTitleSuggestion()}>
              忽略
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default function CopilotPanel() {
  const docId = useDocStore((s) => s.docId)
  const setRightOpen = useUiStore((s) => s.setRightOpen)

  return (
    <aside className="flex h-full min-w-0 flex-col border-l border-line bg-sidebar">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-serif text-[15px] font-bold text-foreground">
          <Sparkles className="h-4 w-4 text-accent" />
          AI 精修助手
        </h2>
        <button
          onClick={() => setRightOpen(false)}
          title="收起面板"
          aria-label="收起 AI 精修助手"
          className="rounded-lg p-1.5 text-faint transition-colors hover:bg-sunken hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {docId ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <DocumentSection />
          <SelectionSection />
          <TitleSection />
          <p className="px-1 pb-1 text-[11px] leading-relaxed text-faint">
            AI 改写以 Diff 预览，只有点击「应用替换」才会写入正文；原文会保存在「历史版本」中。
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <FileText className="h-8 w-8 text-faint/60" />
          <p className="text-[13px] font-medium text-subtle">还没有打开文稿</p>
          <p className="max-w-[220px] text-[12px] leading-relaxed text-faint">
            从左侧文稿库选择一篇，或新建转写后，这里会展示润色、划词改写与标题生成能力。
          </p>
        </div>
      )}
    </aside>
  )
}

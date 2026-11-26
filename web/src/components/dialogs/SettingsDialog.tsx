import { useEffect, useState } from 'react'
import {
  BookOpen,
  BookText,
  Check,
  Cpu,
  FlaskConical,
  HardDrive,
  Loader2,
  Plus,
  Save,
  Server,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  createPrompt,
  deletePrompt,
  getGlossary,
  testLlm,
  updateGlossary,
  updatePrompt,
  updateSettings,
} from '@/api/settings'
import { getErrorMessage } from '@/api/client'
import { useConfigStore } from '@/store/configStore'
import { useToastStore } from '@/store/toastStore'
import type { Preset, PresetInput, TestLlmResult } from '@/api/types'
import type { SettingsTab } from '@/store/uiStore'
import { usePresets } from './data'

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'llm', label: '大模型', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: 'stt', label: '语音识别', icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: 'general', label: '存储与默认', icon: <HardDrive className="h-3.5 w-3.5" /> },
  { id: 'prompts', label: '润色模板', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: 'glossary', label: '术语词典', icon: <BookText className="h-3.5 w-3.5" /> },
]

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-faint">{hint}</span>}
    </label>
  )
}

function LlmTab() {
  const settings = useConfigStore((s) => s.settings)
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [temperature, setTemperature] = useState('0.3')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestLlmResult | null>(null)

  useEffect(() => {
    if (!settings) return
    setBaseUrl(settings.llm.base_url)
    setModel(settings.llm.model)
    setTemperature(String(settings.llm.temperature))
  }, [settings])

  const save = async () => {
    setSaving(true)
    try {
      const next = await updateSettings({
        llm: {
          base_url: baseUrl.trim(),
          model: model.trim(),
          temperature: Number(temperature) || 0,
          api_key: apiKey.trim() || undefined,
        },
      })
      useConfigStore.getState().setSettings(next)
      setApiKey('')
      useToastStore.getState().success('已保存大模型配置')
    } catch (e) {
      useToastStore.getState().error('保存失败', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setResult(null)
    try {
      setResult(await testLlm())
    } catch (e) {
      setResult({ ok: false, message: getErrorMessage(e, '连接测试失败'), models: [] })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-3">
      <Row label="服务地址（OpenAI-Compatible）" hint="例如 Ollama: http://localhost:11434/v1，或云端 DeepSeek / Qwen 兼容端点">
        <input className="field" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:11434/v1" />
      </Row>
      <Row label="模型名称">
        <input className="field" value={model} onChange={(e) => setModel(e.target.value)} placeholder="qwen3:8b" />
      </Row>
      <div className="grid grid-cols-2 gap-3">
        <Row label="API Key" hint={settings?.llm.api_key_set ? '已配置；留空则不修改' : '未配置（本地 Ollama 可填任意值）'}>
          <input className="field" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="留空保持不变" />
        </Row>
        <Row label="Temperature">
          <input className="field" type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
        </Row>
      </div>

      {result && (
        <p
          className={cn(
            'flex items-start gap-1.5 rounded-lg px-3 py-2 text-[12px] leading-relaxed',
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
          )}
        >
          <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', !result.ok && 'hidden')} />
          <span>
            {result.message}
            {result.models.length > 0 && <span className="ml-1 text-faint">（可用模型：{result.models.slice(0, 4).join('、')}…）</span>}
          </span>
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="outline" size="sm" onClick={() => void test()} disabled={testing || saving}>
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
          测试连通性
        </Button>
        <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving || testing}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存
        </Button>
      </div>
    </div>
  )
}

function SttTab() {
  const settings = useConfigStore((s) => s.settings)
  const [engine, setEngine] = useState('funasr')
  const [device, setDevice] = useState('cpu')
  const [language, setLanguage] = useState('zh')
  const [vad, setVad] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setEngine(settings.stt.engine)
    setDevice(settings.stt.device)
    setLanguage(settings.stt.language)
    setVad(settings.stt.vad)
  }, [settings])

  const save = async () => {
    setSaving(true)
    try {
      const next = await updateSettings({
        stt: { engine: engine as 'funasr' | 'mock', device: device as 'cpu' | 'cuda', language, vad },
      })
      useConfigStore.getState().setSettings(next)
      useToastStore.getState().success('已保存语音识别配置', '新配置对之后创建的任务生效')
    } catch (e) {
      useToastStore.getState().error('保存失败', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Row label="识别引擎">
          <select className="field" value={engine} onChange={(e) => setEngine(e.target.value)}>
            <option value="funasr">FunASR（本地模型）</option>
            <option value="mock">Mock（演示 / 测试，无模型）</option>
          </select>
        </Row>
        <Row label="推理设备">
          <select className="field" value={device} onChange={(e) => setDevice(e.target.value)}>
            <option value="cpu">CPU</option>
            <option value="cuda">CUDA（NVIDIA GPU）</option>
          </select>
        </Row>
      </div>
      <Row label="默认语言">
        <input className="field" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="zh" />
      </Row>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-sunken/40 px-3 py-2.5">
        <input type="checkbox" checked={vad} onChange={(e) => setVad(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
        <span>
          <span className="block text-[13px] font-medium text-foreground">启用 VAD 智能断句</span>
          <span className="block text-[11.5px] leading-relaxed text-faint">
            按真实停顿切分并合并短段，避免按固定时长硬切导致的词语截断。
          </span>
        </span>
      </label>
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存
        </Button>
      </div>
    </div>
  )
}

function GeneralTab() {
  const settings = useConfigStore((s) => s.settings)
  const presets = usePresets()
  const [outputDir, setOutputDir] = useState('')
  const [preset, setPreset] = useState('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setOutputDir(settings.storage.output_dir)
    setPreset(settings.default_preset)
  }, [settings])

  const save = async () => {
    setSaving(true)
    try {
      const next = await updateSettings({
        storage: { output_dir: outputDir.trim() },
        default_preset: preset,
      })
      useConfigStore.getState().setSettings(next)
      useToastStore.getState().success('已保存', 'Markdown 将保存到新的输出目录')
    } catch (e) {
      useToastStore.getState().error('保存失败', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Row label="Markdown 输出根目录" hint="生成的 .md 文稿直接保存到该文件夹（相对路径或绝对路径）">
        <input className="field font-mono text-[12.5px]" value={outputDir} onChange={(e) => setOutputDir(e.target.value)} placeholder="workspace" />
      </Row>
      <Row label="默认润色预设" hint="新建转写时预选的模板，可随时在弹窗中修改">
        <select className="field" value={preset} onChange={(e) => setPreset(e.target.value)}>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Row>
      <div className="flex justify-end border-t border-line pt-3">
        <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存
        </Button>
      </div>
    </div>
  )
}

function PromptsTab() {
  const presets = usePresets()
  const [selected, setSelected] = useState<string | null>(presets[0]?.id ?? null)
  const current: Preset | undefined = presets.find((p) => p.id === selected)
  const [form, setForm] = useState<PresetInput>({ name: '', description: '', system_prompt: '' })
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyDelete, setBusyDelete] = useState(false)

  useEffect(() => {
    if (!current) {
      setForm({ name: '', description: '', system_prompt: '' })
      return
    }
    setForm({ name: current.name, description: current.description ?? '', system_prompt: current.system_prompt })
  }, [current])

  const refresh = () => void useConfigStore.getState().loadPresets()

  const save = async () => {
    setSaving(true)
    try {
      if (creating || !current) {
        const created = await createPrompt(form)
        useToastStore.getState().success('已创建模板', created.name)
        setSelected(created.id)
        setCreating(false)
      } else {
        await updatePrompt(current.id, form)
        useToastStore.getState().success('已保存模板', form.name)
      }
      refresh()
    } catch (e) {
      useToastStore.getState().error('保存失败', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!current) return
    setBusyDelete(true)
    try {
      await deletePrompt(current.id)
      useToastStore.getState().success('已删除模板', current.name)
      setSelected(null)
      refresh()
    } catch (e) {
      useToastStore.getState().error('删除失败', getErrorMessage(e))
    } finally {
      setBusyDelete(false)
    }
  }

  const readOnly = !creating && !!current?.builtin

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-faint">内置模板只读；可「另存为新模板」后再修改</span>
        <Button
          variant="soft"
          size="xs"
          onClick={() => {
            setCreating(true)
            setSelected(null)
            setForm({
              name: current ? `${current.name}（副本）` : '',
              description: current?.description ?? '',
              system_prompt: current?.system_prompt ?? '',
            })
          }}
        >
          <Plus className="h-3 w-3" />
          另存为新模板
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="max-h-[240px] w-40 shrink-0 overflow-y-auto rounded-xl border border-line bg-sunken/40 p-1">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setCreating(false)
                setSelected(p.id)
              }}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors',
                selected === p.id ? 'bg-surface font-medium text-accent shadow-sm' : 'text-subtle hover:bg-surface/70',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.builtin && <span className="shrink-0 rounded bg-accent/10 px-1 text-[9px] text-accent">内置</span>}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            className="field"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="模板名称"
            disabled={readOnly}
          />
          <input
            className="field"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="一句话说明（可选）"
            disabled={readOnly}
          />
          <textarea
            className="field min-h-[150px] resize-y font-mono text-[12px] leading-relaxed"
            value={form.system_prompt}
            onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
            placeholder="系统提示词：告诉模型如何整理这段转写文本"
            disabled={readOnly}
          />
          <div className="flex justify-end gap-2">
            {!readOnly && current && !current.builtin && !creating && (
              <Button variant="ghost" size="sm" onClick={() => void remove()} disabled={busyDelete}>
                {busyDelete ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                删除
              </Button>
            )}
            {!readOnly && (
              <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving || !form.name.trim()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {creating ? '创建模板' : '保存模板'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function GlossaryTab() {
  const [hotwords, setHotwords] = useState('')
  const [rows, setRows] = useState<{ wrong: string; right: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const g = await getGlossary()
        if (!alive) return
        setHotwords(g.hotwords.join(', '))
        setRows(g.corrections)
      } catch (e) {
        useToastStore.getState().error('读取术语词典失败', getErrorMessage(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const g = await updateGlossary({
        hotwords: hotwords
          .split(/[,，、\s]+/)
          .map((x) => x.trim())
          .filter(Boolean),
        corrections: rows.filter((r) => r.wrong.trim() && r.right.trim()),
      })
      setHotwords(g.hotwords.join(', '))
      setRows(g.corrections)
      useConfigStore.getState().loadGlossary()
      useToastStore.getState().success('已保存术语词典')
    } catch (e) {
      useToastStore.getState().error('保存失败', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8 text-faint">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Row label="转写热词" hint="逗号分隔。转写时注入识别引擎，提升专有名词召回率">
        <textarea
          className="field min-h-[70px] resize-y"
          value={hotwords}
          onChange={(e) => setHotwords(e.target.value)}
          placeholder="例如：地变, 井卦, 既济卦, FastAPI"
        />
      </Row>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label !mb-0">同音错词纠正</span>
          <Button variant="ghost" size="xs" onClick={() => setRows((r) => [...r, { wrong: '', right: '' }])}>
            <Plus className="h-3 w-3" />
            添加规则
          </Button>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-faint">润色时自动将「错词」替换为「正确写法」，专治专业领域语音误识。</p>
        <div className="space-y-1.5">
          {rows.length === 0 && <p className="rounded-lg bg-sunken px-3 py-2 text-[12px] text-faint">还没有纠正规则</p>}
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                className="field !py-1.5 text-[12.5px]"
                value={r.wrong}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (i === j ? { ...x, wrong: e.target.value } : x)))}
                placeholder="识别出的错词"
              />
              <span className="shrink-0 text-faint">→</span>
              <input
                className="field !py-1.5 text-[12.5px]"
                value={r.right}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (i === j ? { ...x, right: e.target.value } : x)))}
                placeholder="标准写法"
              />
              <button
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                className="shrink-0 rounded p-1 text-faint hover:text-danger"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-3">
        <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存
        </Button>
      </div>
    </div>
  )
}

export default function SettingsDialog({
  initialTab,
  onClose,
}: {
  initialTab?: SettingsTab
  onClose: () => void
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? 'llm')

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Server className="h-4 w-4 text-accent" />
          系统设置
        </span>
      }
      description="运行时配置会写入 data/runtime_config.json，修改即时生效"
      width="xl"
    >
      <div className="flex min-h-[380px] gap-4">
        <nav className="w-[132px] shrink-0 space-y-0.5 border-r border-line pr-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors',
                tab === t.id ? 'bg-accent/10 font-medium text-accent' : 'text-subtle hover:bg-sunken hover:text-foreground',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {tab === 'llm' && <LlmTab />}
          {tab === 'stt' && <SttTab />}
          {tab === 'general' && <GeneralTab />}
          {tab === 'prompts' && <PromptsTab />}
          {tab === 'glossary' && <GlossaryTab />}
        </div>
      </div>
    </Modal>
  )
}

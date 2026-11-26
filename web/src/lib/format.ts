import type { Task, TaskStatus } from '@/api/types'

export function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const rr = String(r).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rr}` : `${m}:${rr}`
}

export const formatMs = (ms: number) => formatClock(ms / 1000)

export function formatDurationCn(sec: number): string {
  if (!sec || sec < 1) return ''
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}小时${m}分`
  if (m > 0) return r > 0 && m < 10 ? `${m}分${r}秒` : `${m}分钟`
  return `${r}秒`
}

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = 60_000
  if (diff < min) return '刚刚'
  if (diff < 60 * min) return `${Math.floor(diff / min)} 分钟前`
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))} 小时前`
  if (diff < 7 * 24 * 60 * min) return `${Math.floor(diff / (24 * 60 * min))} 天前`
  const d = new Date(t)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return sameYear
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** 中文按字、英文按词统计 */
export function countWords(text: string): number {
  const cjk = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0
  const latin =
    text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)
      ?.length ?? 0
  return cjk + latin
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  queued: '排队中',
  preprocessing: '预处理',
  transcribing: '转写中',
  polishing: 'AI 润色中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

export function isTaskActive(t: Pick<Task, 'status'>): boolean {
  return (
    t.status === 'queued' ||
    t.status === 'preprocessing' ||
    t.status === 'transcribing' ||
    t.status === 'polishing'
  )
}

export function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

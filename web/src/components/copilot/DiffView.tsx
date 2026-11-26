import { useMemo, useState } from 'react'
import { diffLines, diffWordsWithSpace } from 'diff'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import MarkdownPreview from '@/components/editor/MarkdownPreview'

interface Seg {
  text: string
  changed: boolean
}

interface Row {
  kind: 'same' | 'add' | 'del'
  text: string
  segs?: Seg[]
  /** 连续未改动行分组 id */
  run?: number
}

function splitLines(v: string): string[] {
  const lines = v.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

const norm = (s: string) => (s.endsWith('\n') ? s : `${s}\n`)

function inlineDiff(a: string, b: string): { del: Seg[]; add: Seg[] } | null {
  if (a.length > 1500 || b.length > 1500) return null
  const parts = diffWordsWithSpace(a, b)
  let same = 0
  for (const p of parts) if (!p.added && !p.removed) same += p.value.length
  if (same / Math.max(a.length, b.length, 1) < 0.3) return null
  const del: Seg[] = []
  const add: Seg[] = []
  for (const p of parts) {
    if (p.added) add.push({ text: p.value, changed: true })
    else if (p.removed) del.push({ text: p.value, changed: true })
    else {
      del.push({ text: p.value, changed: false })
      add.push({ text: p.value, changed: false })
    }
  }
  return { del, add }
}

function buildDiffRows(oldText: string, newText: string): Row[] {
  const parts = diffLines(norm(oldText), norm(newText))
  const rows: Row[] = []
  let run = 0
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (p.removed) {
      const next = parts[i + 1]
      const dl = splitLines(p.value)
      if (next?.added) {
        const al = splitLines(next.value)
        const delRows: Row[] = dl.map((t) => ({ kind: 'del', text: t }))
        const addRows: Row[] = al.map((t) => ({ kind: 'add', text: t }))
        const n = Math.min(dl.length, al.length)
        for (let k = 0; k < n; k++) {
          const d = inlineDiff(dl[k], al[k])
          if (d) {
            delRows[k].segs = d.del
            addRows[k].segs = d.add
          }
        }
        rows.push(...delRows, ...addRows)
        i++
      } else {
        rows.push(...dl.map((t): Row => ({ kind: 'del', text: t })))
      }
      run++
    } else if (p.added) {
      rows.push(...splitLines(p.value).map((t): Row => ({ kind: 'add', text: t })))
      run++
    } else {
      const id = run++
      rows.push(...splitLines(p.value).map((t): Row => ({ kind: 'same', text: t, run: id })))
    }
  }
  return rows
}

const COLLAPSE_OVER = 8
const KEEP = 3

interface Props {
  oldText: string
  newText: string
  /** 结果标签页的标题，默认“结果” */
  resultLabel?: string
  maxHeightClass?: string
}

export default function DiffView({ oldText, newText, resultLabel = '结果', maxHeightClass = 'max-h-[46vh]' }: Props) {
  const [tab, setTab] = useState<'diff' | 'result'>('diff')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const rows = useMemo(() => buildDiffRows(oldText, newText), [oldText, newText])
  const stats = useMemo(() => {
    let add = 0
    let del = 0
    for (const r of rows) {
      if (r.kind === 'add') add++
      else if (r.kind === 'del') del++
    }
    return { add, del }
  }, [rows])

  const runLen = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of rows) if (r.kind === 'same' && r.run !== undefined) m.set(r.run, (m.get(r.run) ?? 0) + 1)
    return m
  }, [rows])

  const rendered: React.ReactNode[] = []
  const seen = new Map<number, number>()
  rows.forEach((r, idx) => {
    if (r.kind === 'same' && r.run !== undefined) {
      const total = runLen.get(r.run) ?? 0
      const pos = seen.get(r.run) ?? 0
      seen.set(r.run, pos + 1)
      const collapsible = total > COLLAPSE_OVER && !expanded.has(r.run)
      if (collapsible) {
        if (pos >= KEEP && pos < total - KEEP) {
          if (pos === KEEP) {
            const hidden = total - KEEP * 2
            const runId = r.run
            rendered.push(
              <button
                key={`c-${idx}`}
                onClick={() => setExpanded((s) => new Set(s).add(runId))}
                className="flex w-full items-center justify-center gap-1.5 bg-sunken py-1 text-[11px] text-faint hover:text-accent"
              >
                <ChevronsUpDown className="h-3 w-3" />
                展开 {hidden} 行未改动内容
              </button>,
            )
          }
          return
        }
      }
    }
    rendered.push(
      <div
        key={idx}
        className={cn(
          'flex min-h-[1.7em] gap-2 px-3 py-px',
          r.kind === 'add' && 'diff-row-add',
          r.kind === 'del' && 'diff-row-del',
        )}
      >
        <span
          className={cn(
            'w-3 shrink-0 select-none text-center font-mono text-[11px] leading-[1.7]',
            r.kind === 'add' && 'text-success',
            r.kind === 'del' && 'text-danger',
            r.kind === 'same' && 'text-faint/50',
          )}
        >
          {r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ''}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-[1.7]',
            r.kind === 'same' && 'text-subtle',
          )}
        >
          {r.segs
            ? r.segs.map((s, i) =>
                s.changed ? (
                  <span key={i} className={r.kind === 'add' ? 'diff-mark-add' : 'diff-mark-del'}>
                    {s.text}
                  </span>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )
            : r.text || '\u00A0'}
        </span>
      </div>,
    )
  })

  const identical = stats.add === 0 && stats.del === 0

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-sunken/60 px-2 py-1.5">
        <div className="inline-flex rounded-md bg-sunken p-0.5">
          {(['diff', 'result'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                tab === t ? 'bg-surface text-foreground shadow-sm' : 'text-subtle hover:text-foreground',
              )}
            >
              {t === 'diff' ? '对比' : resultLabel}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-success">+{stats.add}</span>
          <span className="text-danger">−{stats.del}</span>
        </span>
      </div>
      <div className={cn('overflow-y-auto', maxHeightClass)}>
        {tab === 'diff' ? (
          identical ? (
            <p className="px-4 py-6 text-center text-xs text-faint">内容没有变化</p>
          ) : (
            <div className="py-1">{rendered}</div>
          )
        ) : (
          <div className="px-4 py-3">
            <MarkdownPreview content={newText} className="!text-[14px] !leading-[1.8]" />
          </div>
        )}
      </div>
    </div>
  )
}

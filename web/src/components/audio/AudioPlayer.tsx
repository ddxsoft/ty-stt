import { useEffect, useRef } from 'react'
import { Gauge, Pause, Play, RotateCcw, RotateCw, Volume2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { audioUrl } from '@/api/documents'
import { Menu } from '@/components/ui/Menu'
import { formatMs } from '@/lib/format'
import { PLAYBACK_RATES, usePlayerStore } from '@/store/playerStore'

function SeekBar({ valueMs, durationMs, onSeek }: { valueMs: number; durationMs: number; onSeek: (ms: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = durationMs > 0 ? Math.min(100, (valueMs / durationMs) * 100) : 0

  const calc = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || durationMs <= 0) return
    onSeek(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * durationMs)
  }

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-valuenow={Math.round(valueMs / 1000)}
      tabIndex={0}
      className="group relative flex h-6 flex-1 cursor-pointer touch-none items-center"
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        calc(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && calc(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') usePlayerStore.getState().skip(-5000)
        if (e.key === 'ArrowRight') usePlayerStore.getState().skip(5000)
      }}
    >
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken group-hover:h-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div
        className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-accent bg-surface opacity-0 shadow transition-opacity group-hover:opacity-100"
        style={{ left: `${pct}%` }}
      />
    </div>
  )
}

export default function AudioPlayer({ docId, fallbackSeconds }: { docId: string; fallbackSeconds: number }) {
  const setEl = usePlayerStore((s) => s.setEl)
  const currentMs = usePlayerStore((s) => s.currentMs)
  const durationMs = usePlayerStore((s) => s.durationMs)
  const playing = usePlayerStore((s) => s.playing)
  const rate = usePlayerStore((s) => s.rate)
  const error = usePlayerStore((s) => s.error)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const { patch } = usePlayerStore.getState()
    setEl(el)
    el.playbackRate = usePlayerStore.getState().rate
    let raf = 0

    const dur = () =>
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 : fallbackSeconds * 1000

    const loop = () => {
      patch({ currentMs: el.currentTime * 1000 })
      raf = requestAnimationFrame(loop)
    }
    const onPlay = () => {
      patch({ playing: true })
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }
    const onPause = () => {
      patch({ playing: false, currentMs: el.currentTime * 1000 })
      cancelAnimationFrame(raf)
    }
    const onMeta = () => {
      el.playbackRate = usePlayerStore.getState().rate
      patch({ durationMs: dur(), error: false })
    }
    const onTime = () => {
      if (el.paused) patch({ currentMs: el.currentTime * 1000 })
      // webm 录音的 duration 可能先为 Infinity，播放后才确定
      if (Number.isFinite(el.duration)) patch({ durationMs: el.duration * 1000 })
    }
    const onErr = () => patch({ error: true })

    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onPause)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('durationchange', onMeta)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('error', onErr)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onPause)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('durationchange', onMeta)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('error', onErr)
      el.pause()
      setEl(null)
    }
  }, [docId, fallbackSeconds, setEl])

  const { toggle, skip, seekMs, setRate } = usePlayerStore.getState()
  const total = durationMs || fallbackSeconds * 1000

  return (
    <div className="shrink-0 border-t border-line bg-surface px-4 py-2.5">
      <audio ref={audioRef} key={docId} src={audioUrl(docId)} preload="metadata" />
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => skip(-3000)}
            title="后退 3 秒 (Alt+←)"
            aria-label="后退 3 秒"
            disabled={error}
            className="flex h-8 w-8 items-center justify-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={toggle}
            title="播放/暂停 (Alt+空格)"
            aria-label={playing ? '暂停' : '播放'}
            disabled={error}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            {playing ? <Pause className="h-[18px] w-[18px]" fill="currentColor" /> : <Play className="ml-0.5 h-[18px] w-[18px]" fill="currentColor" />}
          </button>
          <button
            onClick={() => skip(3000)}
            title="前进 3 秒 (Alt+→)"
            aria-label="前进 3 秒"
            disabled={error}
            className="flex h-8 w-8 items-center justify-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-foreground disabled:opacity-40"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        <span className="w-11 text-right font-mono text-xs tabular-nums text-subtle">{formatMs(currentMs)}</span>
        <SeekBar valueMs={currentMs} durationMs={total} onSeek={(ms) => seekMs(ms)} />
        <span className="w-11 font-mono text-xs tabular-nums text-faint">{formatMs(total)}</span>

        <Menu
          align="right"
          placement="top"
          menuClassName="min-w-[110px]"
          trigger={() => (
            <button
              title="播放速度"
              className="flex h-8 items-center gap-1 rounded-lg px-2 font-mono text-xs tabular-nums text-subtle transition-colors hover:bg-sunken hover:text-foreground"
            >
              <Gauge className="h-3.5 w-3.5" />
              {rate}x
            </button>
          )}
          items={PLAYBACK_RATES.map((r) => ({
            label: `${r}x${r === 1 ? '（正常）' : ''}`,
            active: r === rate,
            onClick: () => setRate(r),
          }))}
        />
        <Volume2 className={cn('hidden h-4 w-4 text-faint md:block', error && 'text-danger')} />
      </div>
      {error && <p className="mt-1 text-center text-xs text-danger">音频加载失败，请确认服务端音频文件仍存在</p>}
    </div>
  )
}

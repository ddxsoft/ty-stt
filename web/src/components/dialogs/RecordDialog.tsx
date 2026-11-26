import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Pause, Play, RotateCcw, Square, UploadCloud } from 'lucide-react'
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
import { formatClock, timestamp } from '@/lib/format'

type Phase = 'idle' | 'recording' | 'paused' | 'ready'

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((m) => MediaRecorder.isTypeSupported(m))
}

function extOfMime(mime: string): string {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

export default function RecordDialog({ onClose }: { onClose: () => void }) {
  const currentFolder = useLibraryStore((s) => s.currentFolder)
  const defaultPreset = useConfigStore((s) => s.settings?.default_preset ?? 'medium')
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [folder, setFolder] = useState(currentFolder)
  const [preset, setPreset] = useState(defaultPreset)
  const [uploading, setUploading] = useState<number | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const stopMeter = () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }

  const drawMeter = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    const w = canvas.clientWidth * devicePixelRatio
    const h = canvas.clientHeight * devicePixelRatio
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const g = canvas.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, canvas.width, canvas.height)

    const rect = canvas.getBoundingClientRect()
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    g.fillStyle = accent ? `hsl(${accent})` : '#c2410c'
    const bars = 48
    const gap = 2 * devicePixelRatio
    const bw = (rect.width * devicePixelRatio - gap * (bars - 1)) / bars
    for (let i = 0; i < bars; i++) {
      const level = meterLevels.current[i] ?? 0
      const bh = Math.max(2 * devicePixelRatio, level * rect.height * devicePixelRatio * 0.9)
      const x = i * (bw + gap)
      const y = (rect.height * devicePixelRatio - bh) / 2
      g.fillRect(x, y, bw, bh)
    }
    rafRef.current = requestAnimationFrame(drawMeter)
  }

  const meterLevels = useRef<number[]>(Array.from({ length: 48 }, () => 0))

  const startMeter = (stream: MediaStream) => {
    const ac = new AudioContext()
    ctxRef.current = ac
    const analyser = ac.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.7
    const src = ac.createMediaStreamSource(stream)
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(data)
      const step = Math.floor(data.length / meterLevels.current.length)
      for (let i = 0; i < meterLevels.current.length; i++) {
        const v = data[Math.min(data.length - 1, i * step)] / 255
        meterLevels.current[i] = v
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
    rafRef.current = 0
    drawMeter()
  }

  const cleanupRecorder = () => {
    stopMeter()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    recRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close().catch(() => undefined)
    ctxRef.current = null
  }

  const cleanupRef = useRef(cleanupRecorder)
  useEffect(() => {
    cleanupRef.current = cleanupRecorder
  })

  useEffect(() => {
    return () => {
      const rec = recRef.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        rec.onerror = null
        rec.stop()
      }
      cleanupRef.current()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      const mime = pickMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recRef.current = rec
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm'
        const next = new Blob(chunksRef.current, { type })
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        const url = URL.createObjectURL(next)
        previewUrlRef.current = url
        setBlob(next)
        setPreviewUrl(url)
        setPhase('ready')
        cleanupRecorder()
      }
      rec.start(1000)
      setSeconds(0)
      setPhase('recording')
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      startMeter(stream)
    } catch (e) {
      cleanupRecorder()
      setPhase('idle')
      useToastStore.getState().error(
        '无法访问麦克风',
        e instanceof Error ? e.message : '请检查浏览器权限与系统录音设备',
      )
    }
  }

  const pause = () => {
    const rec = recRef.current
    if (!rec || rec.state !== 'recording') return
    rec.pause()
    setPhase('paused')
    stopMeter()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const resume = () => {
    const rec = recRef.current
    if (!rec || rec.state !== 'paused') return
    rec.resume()
    setPhase('recording')
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    if (streamRef.current) startMeter(streamRef.current)
  }

  const stop = () => {
    const rec = recRef.current
    if (!rec) return
    if (rec.state !== 'inactive') rec.stop()
  }

  const reset = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setBlob(null)
    setSeconds(0)
    setPhase('idle')
  }

  const upload = async () => {
    if (!blob) return
    setUploading(0)
    try {
      const name = `录音_${timestamp()}.${extOfMime(blob.type)}`
      const tasks = await createTranscriptions([{ blob, name }], { folder, preset }, (pct) =>
        setUploading(pct),
      )
      useTaskStore.getState().upsertMany(tasks)
      useToastStore.getState().success('录音已提交转写', name)
      useUiStore.getState().closeDialog()
    } catch (e) {
      setUploading(null)
      useToastStore.getState().error('提交失败', getErrorMessage(e))
    }
  }

  const busy = uploading !== null

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title="实时录音"
      description="使用麦克风录制音频，结束后会自动进入转写与润色流程。"
      width="md"
      footer={
        phase === 'ready' ? (
          <>
            <Button variant="ghost" onClick={reset} disabled={busy}>
              <RotateCcw className="h-4 w-4" />
              重新录制
            </Button>
            <Button variant="primary" onClick={() => void upload()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {busy ? `上传中 ${uploading}%` : '上传并转写'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              取消
            </Button>
            {phase === 'idle' && (
              <Button variant="primary" onClick={() => void start()}>
                <Mic className="h-4 w-4" />
                开始录音
              </Button>
            )}
            {phase === 'recording' && (
              <>
                <Button variant="outline" onClick={pause}>
                  <Pause className="h-4 w-4" />
                  暂停
                </Button>
                <Button variant="danger" onClick={stop}>
                  <Square className="h-3.5 w-3.5" />
                  结束录音
                </Button>
              </>
            )}
            {phase === 'paused' && (
              <>
                <Button variant="outline" onClick={resume}>
                  <Play className="h-4 w-4" />
                  继续
                </Button>
                <Button variant="danger" onClick={stop}>
                  <Square className="h-3.5 w-3.5" />
                  结束录音
                </Button>
              </>
            )}
          </>
        )
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-sunken/40 px-4 py-5">
          <canvas ref={canvasRef} className="h-20 w-full" />
          <div className="flex items-center gap-2 font-mono text-[15px] tabular-nums text-foreground">
            {phase === 'recording' && <span className="h-2 w-2 animate-rec-pulse rounded-full bg-danger" />}
            {phase === 'paused' && <span className="h-2 w-2 rounded-full bg-warning" />}
            {formatClock(seconds)}
          </div>
          <p className="text-[11.5px] text-faint">
            {phase === 'idle' && '点击「开始录音」授权麦克风后开始录制'}
            {phase === 'recording' && '正在录音，可暂停或结束'}
            {phase === 'paused' && '已暂停，计时与波形停止'}
            {phase === 'ready' && '试听确认后上传，或重新录制'}
          </p>
        </div>

        {phase === 'ready' && previewUrl && (
          <audio controls src={previewUrl} className="h-9 w-full" />
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
      </div>
    </Modal>
  )
}

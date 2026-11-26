import { useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useToastStore, type ToastItem, type ToastType } from '@/store/toastStore'

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const accents: Record<ToastType, string> = {
  success: 'text-success before:bg-success',
  error: 'text-danger before:bg-danger',
  warning: 'text-warning before:bg-warning',
  info: 'text-info before:bg-info',
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  const { id, duration } = toast
  useEffect(() => {
    if (duration > 0) {
      const t = setTimeout(() => onClose(id), duration)
      return () => clearTimeout(t)
    }
  }, [id, duration, onClose])

  const Icon = icons[toast.type]
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto relative flex w-full animate-slide-in-right items-start gap-3 overflow-hidden rounded-xl border border-line bg-surface py-3 pl-5 pr-3 shadow-pop',
        'before:absolute before:inset-y-0 before:left-0 before:w-1',
        accents[toast.type],
      )}
    >
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <div className="min-w-0 flex-1 text-foreground">
        <p className="text-sm font-semibold leading-snug">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 break-words text-[13px] leading-snug text-subtle">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick()
              onClose(id)
            }}
            className="mt-1.5 text-[13px] font-medium text-accent hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onClose(id)}
        aria-label="关闭"
        className="rounded-md p-1 text-faint transition-colors hover:bg-sunken hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.removeToast)
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={remove} />
      ))}
    </div>
  )
}

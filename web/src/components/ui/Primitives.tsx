import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[]
  size?: 'sm' | 'md'
  className?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  return (
    <div className={cn('inline-flex rounded-lg bg-sunken p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md font-medium transition-all disabled:opacity-40',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.value
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-subtle hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface EmptyProps {
  icon: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sunken text-faint">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-faint">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <g className="fill-accent-foreground">
        <rect x="6" y="13" width="3" height="6" rx="1.5" />
        <rect x="11" y="9" width="3" height="14" rx="1.5" />
        <rect x="16" y="5" width="3" height="22" rx="1.5" />
        <rect x="21" y="10" width="3" height="12" rx="1.5" />
        <rect x="26" y="14" width="2" height="4" rx="1" />
      </g>
    </svg>
  )
}

export function Tag({
  children,
  onRemove,
  onClick,
  className,
}: {
  children: ReactNode
  onRemove?: () => void
  onClick?: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-sunken px-1.5 py-0.5 text-[11px] text-subtle',
        onClick && 'cursor-pointer transition-colors hover:bg-accent/10 hover:text-accent',
        className,
      )}
      onClick={onClick}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="移除"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="-mr-0.5 rounded text-faint hover:text-danger"
        >
          ×
        </button>
      )}
    </span>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  active?: boolean
  /** 在该项之前画分割线 */
  divider?: boolean
}

interface MenuProps {
  trigger: (open: boolean) => ReactNode
  items: MenuItem[]
  align?: 'left' | 'right'
  placement?: 'bottom' | 'top'
  className?: string
  menuClassName?: string
}

export function Menu({
  trigger,
  items,
  align = 'left',
  placement = 'bottom',
  className,
  menuClassName,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div
          className={cn(
            'absolute z-50 min-w-[168px] animate-fade-in rounded-xl border border-line bg-surface p-1 shadow-pop',
            placement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {items.map((it, i) => (
            <div key={i}>
              {it.divider && <div className="my-1 h-px bg-line" />}
              <button
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
                  'disabled:pointer-events-none disabled:opacity-40',
                  it.danger
                    ? 'text-danger hover:bg-danger/10'
                    : 'text-foreground hover:bg-sunken',
                  it.active && 'bg-accent/10 font-medium text-accent',
                )}
              >
                {it.icon && <span className="flex h-4 w-4 items-center justify-center">{it.icon}</span>}
                <span className="flex-1">{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
  /** 点击遮罩/Esc 是否可关闭 */
  dismissible?: boolean
  bodyClassName?: string
}

const widths = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
  dismissible = true,
  bodyClassName,
}: ModalProps) {
  useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop',
              widths[width],
            )}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {(title || dismissible) && (
              <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
                <div className="min-w-0">
                  {title && (
                    <h2 className="font-serif text-lg font-semibold leading-tight text-foreground">
                      {title}
                    </h2>
                  )}
                  {description && <p className="mt-1 text-[13px] text-subtle">{description}</p>}
                </div>
                {dismissible && (
                  <button
                    onClick={onClose}
                    aria-label="关闭"
                    className="-mr-2 -mt-1 rounded-lg p-1.5 text-faint transition-colors hover:bg-sunken hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 pb-5', bodyClassName)}>
              {children}
            </div>
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-sunken/40 px-6 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

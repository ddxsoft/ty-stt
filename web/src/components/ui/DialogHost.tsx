import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'
import { useDialogStore } from '@/store/dialogStore'

function PromptForm({
  initial,
  label,
  placeholder,
  onSubmit,
}: {
  initial: string
  label?: string
  placeholder?: string
  onSubmit: (v: string) => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <form
      id="prompt-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSubmit(value.trim())
      }}
    >
      {label && <label className="label">{label}</label>}
      <input
        ref={ref}
        className="field"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  )
}

/** 全局命令式确认框 / 输入框（见 dialogStore） */
export function DialogHost() {
  const req = useDialogStore((s) => s.request)
  const close = useDialogStore((s) => s.close)
  const shown = req

  const done = (v: boolean | string | null) => {
    if (!req) return
    if (req.kind === 'confirm') req.resolve(Boolean(v))
    else req.resolve(typeof v === 'string' ? v : null)
    close()
  }

  if (!shown) return null

  return (
    <Modal
      open
      onClose={() => done(shown.kind === 'confirm' ? false : null)}
      title={shown.title}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => done(shown.kind === 'confirm' ? false : null)}>
            取消
          </Button>
          {shown.kind === 'confirm' ? (
            <Button variant={shown.danger ? 'danger' : 'primary'} onClick={() => done(true)}>
              {shown.confirmText ?? '确定'}
            </Button>
          ) : (
            <Button variant="primary" type="submit" form="prompt-form">
              {shown.confirmText ?? '确定'}
            </Button>
          )}
        </>
      }
    >
      {shown.kind === 'confirm' ? (
        shown.message && <p className="text-sm leading-relaxed text-subtle">{shown.message}</p>
      ) : (
        <PromptForm
          key={shown.title + shown.initial}
          initial={shown.initial ?? ''}
          label={shown.label}
          placeholder={shown.placeholder}
          onSubmit={(v) => done(v)}
        />
      )}
    </Modal>
  )
}

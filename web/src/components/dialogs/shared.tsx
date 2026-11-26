import { cn } from '@/utils/cn'
import { useFolderOptions, usePresets } from './data'

export function FolderSelect({
  value,
  onChange,
  className,
  rootLabel = '根目录（全部文稿）',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  rootLabel?: string
}) {
  const options = useFolderOptions()
  return (
    <select className={cn('field', className)} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{rootLabel}</option>
      {options.map((f) => (
        <option key={f.path} value={f.path}>
          {'\u3000'.repeat(f.depth)}
          {f.name}
        </option>
      ))}
    </select>
  )
}

export function PresetSelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const presets = usePresets()
  return (
    <select className={cn('field', className)} value={value} onChange={(e) => onChange(e.target.value)}>
      {presets.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft'
type Size = 'xs' | 'sm' | 'md' | 'icon' | 'icon-sm'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-foreground shadow-sm hover:brightness-110 active:brightness-95 disabled:hover:brightness-100',
  secondary: 'bg-sunken text-foreground hover:bg-line',
  outline: 'border border-line-strong bg-surface text-foreground hover:bg-sunken',
  ghost: 'text-subtle hover:bg-sunken hover:text-foreground',
  soft: 'bg-accent/10 text-accent hover:bg-accent/15',
  danger: 'bg-danger text-white hover:brightness-110',
}

const sizes: Record<Size, string> = {
  xs: 'h-6 gap-1 rounded-md px-2 text-[11px]',
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-9 gap-2 rounded-lg px-4 text-sm',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-7 w-7 rounded-md',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
}

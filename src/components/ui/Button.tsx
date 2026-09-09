import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface BaseProps {
  variant?: ButtonVariant
  size?: 'md' | 'lg'
  className?: string
  children: React.ReactNode
}

type ButtonAsButton = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }

type ButtonAsLink = BaseProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

type ButtonProps = ButtonAsButton | ButtonAsLink

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-full transition-transform duration-200 ease-[var(--ease-premium,cubic-bezier(0.16,1,0.3,1))] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none'

const sizes = {
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent-strong)] text-zinc-950 hover:bg-[var(--color-accent)] shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_8px_30px_-8px_rgba(16,185,129,0.55)]',
  secondary:
    'border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-ink)] backdrop-blur hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent-soft)]',
  ghost: 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    const classes = cn(base, sizes[size], variants[variant], className)

    if ('href' in props && props.href) {
      const { href, ...rest } = props as ButtonAsLink
      if (href.startsWith('/')) {
        return (
          <Link to={href} className={classes} {...rest}>
            {children}
          </Link>
        )
      }
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={classes}
          {...rest}
        >
          {children}
        </a>
      )
    }

    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} className={classes} {...(props as ButtonAsButton)}>
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'

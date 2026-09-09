import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  optional?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, error, optional, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--color-ink)]">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-[var(--color-ink-faint)]">(optional)</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}

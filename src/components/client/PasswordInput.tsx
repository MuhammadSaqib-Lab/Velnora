import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { fieldInputClass } from '@/components/ui/fieldStyles'

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  describedBy,
  invalid,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  placeholder?: string
  describedBy?: string
  invalid?: boolean
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        maxLength={200}
        className={`${fieldInputClass} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
      >
        {visible ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
      </button>
    </div>
  )
}

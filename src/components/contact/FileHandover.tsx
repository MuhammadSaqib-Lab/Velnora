import { AlertCircle, FileArchive, GitBranch, UploadCloud, X } from 'lucide-react'
import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Field } from '@/components/ui/Field'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { ACCEPTED_HANDOVER_EXTENSIONS, MAX_HANDOVER_FILE_SIZE_BYTES } from '@/lib/contact'
import { cn } from '@/lib/utils'
import { MAX_LENGTHS } from '@/lib/validation'

interface FileHandoverProps {
  files: File[]
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  repoLink: string
  onRepoLinkChange: (value: string) => void
  repoLinkError?: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase()
  return ACCEPTED_HANDOVER_EXTENSIONS.some((ext) => name.endsWith(ext))
}

/**
 * Files are staged client-side only, there's no upload endpoint yet
 * (the backend accepts the text fields in this form, not file bytes).
 * The copy here deliberately avoids implying a real transfer happens
 * until that's wired up.
 */
export function FileHandover({
  files,
  onAddFiles,
  onRemoveFile,
  repoLink,
  onRepoLinkChange,
  repoLinkError,
}: FileHandoverProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  function processFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const accepted: File[] = []
    let error: string | null = null

    for (const file of Array.from(fileList)) {
      if (!isAcceptedFile(file)) {
        error = `${file.name} isn't a supported archive type (${ACCEPTED_HANDOVER_EXTENSIONS.join(', ')}).`
        continue
      }
      if (file.size > MAX_HANDOVER_FILE_SIZE_BYTES) {
        error = `${file.name} is over the 50MB limit.`
        continue
      }
      accepted.push(file)
    }

    setFileError(error)
    if (accepted.length > 0) onAddFiles(accepted)
  }

  function openBrowser() {
    inputRef.current?.click()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openBrowser()
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    processFiles(event.dataTransfer.files)
  }

  return (
    <div>
      <h3 className="text-base font-medium text-[var(--color-ink)]">Project & File Handover</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
        Rebuilding an existing site or requesting an SEO audit? Attach your current codebase or
        export for context, or drop a link below if that's easier.
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={openBrowser}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-panel)] border border-dashed px-6 py-8 text-center transition-colors',
          isDragging
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)]/40'
            : 'border-white/[0.15] bg-white/[0.02] hover:border-white/[0.3]',
        )}
      >
        <UploadCloud className="h-6 w-6 text-[var(--color-accent)]" strokeWidth={1.5} />
        <p className="text-sm font-medium text-[var(--color-ink)]">
          Drag & drop your ZIP or code export
        </p>
        <p className="text-xs text-[var(--color-ink-faint)]">
          or click to browse, {ACCEPTED_HANDOVER_EXTENSIONS.join(', ')} up to 50MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          aria-label="Upload project files"
          accept={ACCEPTED_HANDOVER_EXTENSIONS.join(',')}
          onChange={(e) => {
            processFiles(e.target.files)
            e.target.value = ''
          }}
          className="sr-only"
        />
      </div>

      {fileError ? (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {fileError}
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] border border-white/[0.1] bg-white/[0.02] px-4 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <FileArchive
                  className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  strokeWidth={1.75}
                />
                <span className="truncate text-sm text-[var(--color-ink)]">{file.name}</span>
                <span className="shrink-0 text-xs text-[var(--color-ink-faint)]">
                  {formatBytes(file.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
        Files stay attached to this form. For anything larger, share a link instead.
      </p>

      <div className="mt-5">
        <Field label="Repository or drive link" htmlFor="repoLink" optional error={repoLinkError}>
          <div className="relative">
            <GitBranch
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]"
              strokeWidth={1.75}
            />
            <input
              id="repoLink"
              name="repoLink"
              type="url"
              maxLength={MAX_LENGTHS.url}
              value={repoLink}
              onChange={(e) => onRepoLinkChange(e.target.value)}
              className={cn(fieldInputClass, 'pl-10')}
              placeholder="https://github.com/your-org/your-repo"
            />
          </div>
        </Field>
      </div>
    </div>
  )
}

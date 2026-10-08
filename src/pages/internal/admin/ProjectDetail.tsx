import { ArrowLeft, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ProjectStatusBadge } from '@/components/client/ProjectStatus'
import { ErrorState } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { fieldInputClass, selectFieldClass } from '@/components/ui/fieldStyles'
import { apiGet, apiPatch, ApiNetworkError } from '@/lib/api'
import {
  formatDate,
  PROJECT_STATUSES,
  projectTypeLabel,
  statusLabel,
  timelineLabel,
  type AdminProject,
  type ProjectStatus,
} from '@/lib/projects'
import { isSafeHttpUrl } from '@/lib/validation'

const MAX_MESSAGE = 1000

/**
 * Admin view of one client project: the client's contact details, the full
 * request, the status history (including who changed what), and the ONLY
 * control in the product that can change a project's status. The message
 * entered with a status change is shown to the client in their portal.
 * The acting admin is recorded server-side from the session.
 */
export function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState<AdminProject | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [nextStatus, setNextStatus] = useState<ProjectStatus | ''>('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await apiGet<{ project: AdminProject }>(`/admin/projects/${encodeURIComponent(id)}`)
      if (res.success && res.data) {
        setProject(res.data.project)
        setError(null)
      } else if (!res.success) {
        setError(res.status === 404 ? 'Project not found.' : res.message)
      }
    } catch (err) {
      setError(err instanceof ApiNetworkError ? err.message : 'Failed to load this project.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!project || !nextStatus || isSaving) return
    setIsSaving(true)
    setNotice(null)
    try {
      const res = await apiPatch<{ project: AdminProject }>(`/admin/projects/${encodeURIComponent(project.id)}/status`, {
        status: nextStatus,
        message: message.trim(),
      })
      if (res.success && res.data) {
        setProject(res.data.project)
        setNextStatus('')
        setMessage('')
        setNotice({ tone: 'ok', text: 'Status updated. The client will see it in their portal.' })
      } else if (!res.success) {
        const detail = res.errors ? ` ${Object.values(res.errors).join(' ')}` : ''
        setNotice({ tone: 'error', text: `${res.message}${detail}` })
        if (res.status === 409) void load()
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiNetworkError ? err.message : 'Status update failed.' })
    } finally {
      setIsSaving(false)
    }
  }

  const back = (
    <Link to="/internal/admin/projects" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
      Projects
    </Link>
  )

  if (error) {
    return (
      <div>
        {back}
        <div className="mt-5">
          <ErrorState message={error} />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div>
        {back}
        <Loader2 className="mt-6 h-5 w-5 animate-spin text-[var(--color-ink-faint)]" strokeWidth={2} />
      </div>
    )
  }

  const history = project.statusHistory ?? []

  return (
    <div>
      {back}

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">
            {project.projectNumber} · {projectTypeLabel(project.projectType)}
          </p>
          <h1 className="mt-1 break-words text-xl font-semibold">{project.projectName}</h1>
        </div>
        <ProjectStatusBadge status={project.status} />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Request">
            <Field label="Description">{project.description}</Field>
            {project.requiredFeatures ? <Field label="Required features">{project.requiredFeatures}</Field> : null}
            {project.targetAudience ? <Field label="Target audience">{project.targetAudience}</Field> : null}
            {project.additionalNotes ? <Field label="Additional notes">{project.additionalNotes}</Field> : null}
            <dl className="grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
              <Mini label="Budget">{project.budgetRange}</Mini>
              <Mini label="Timeline">{timelineLabel(project.timeline)}</Mini>
              <Mini label="Current website">
                {project.websiteUrl ? (
                  isSafeHttpUrl(project.websiteUrl) ? (
                    <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" className="break-all underline decoration-white/20">
                      {project.websiteUrl}
                    </a>
                  ) : (
                    <span className="break-all">{project.websiteUrl}</span>
                  )
                ) : null}
              </Mini>
            </dl>
          </Panel>

          <Panel title="Status history">
            <ol className="space-y-4">
              {[...history].reverse().map((entry) => (
                <li key={entry.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">
                      {entry.oldStatus ? `${statusLabel(entry.oldStatus)} → ` : ''}
                      {statusLabel(entry.newStatus)}
                    </span>
                    <span className="text-xs text-[var(--color-ink-faint)]">
                      {formatDate(entry.createdAt, true)} · {entry.changedBy ?? 'unknown'}
                    </span>
                  </div>
                  {entry.message ? <p className="mt-1 whitespace-pre-wrap break-words text-[var(--color-ink-muted)]">{entry.message}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Client">
            <dl className="space-y-3">
              <Mini label="Name">{project.client.name}</Mini>
              <Mini label="Email">
                <a href={`mailto:${project.client.email}`} className="break-all underline decoration-white/20">
                  {project.client.email}
                </a>
              </Mini>
              <Mini label="Phone">{project.client.phone}</Mini>
              <Mini label="Company">{project.client.company}</Mini>
            </dl>
          </Panel>

          <Panel title="Update status">
            <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
              <div>
                <label htmlFor="next-status" className="text-xs font-medium text-[var(--color-ink-faint)]">
                  New status
                </label>
                <select
                  id="next-status"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as ProjectStatus | '')}
                  className={`${selectFieldClass} mt-1.5`}
                >
                  <option value="">Choose a status…</option>
                  {PROJECT_STATUSES.filter((s) => s !== project.status).map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="status-message" className="text-xs font-medium text-[var(--color-ink-faint)]">
                  Message to the client <span className="font-normal">(optional — visible in their portal)</span>
                </label>
                <textarea
                  id="status-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MAX_MESSAGE}
                  className={`${fieldInputClass} mt-1.5 resize-y`}
                />
              </div>
              <Button type="submit" disabled={!nextStatus || isSaving} className="w-full justify-center">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
                Update status
              </Button>
              {notice ? (
                <p role={notice.tone === 'error' ? 'alert' : 'status'} className={notice.tone === 'error' ? 'text-sm text-red-300' : 'text-sm text-[var(--color-accent-soft)]'}>
                  {notice.text}
                </p>
              ) : null}
            </form>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function Mini({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || <span className="text-[var(--color-ink-faint)]">—</span>}</dd>
    </div>
  )
}

import { ArrowLeft } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ProjectStatusBadge, StatusTimeline } from '@/components/client/ProjectStatus'
import { ErrorState } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { apiGet, ApiNetworkError } from '@/lib/api'
import {
  formatDate,
  projectTypeLabel,
  stageIndex,
  STATUS_DESCRIPTIONS,
  statusLabel,
  timelineLabel,
  type ClientProject,
  type ProjectHistoryEntry,
} from '@/lib/projects'
import { isSafeHttpUrl } from '@/lib/validation'
import { CLIENT_HOME } from '@/lib/useClientSession'
import { useClientOutlet } from './useClientOutlet'

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; notFound?: boolean }
  | { phase: 'ready'; project: ClientProject; history: ProjectHistoryEntry[] }

/**
 * One of the client's own projects. Both requests are scoped server-side
 * to the logged-in client: a project that belongs to someone else (or
 * doesn't exist) comes back as the same 404, which is shown as a plain
 * "not found" — the page never reveals which.
 */
export function ClientProjectDetail() {
  const { id } = useParams()
  const { onUnauthorized } = useClientOutlet()
  const [state, setState] = useState<LoadState>({ phase: 'loading' })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const encoded = encodeURIComponent(id)

    Promise.all([
      apiGet<{ project: ClientProject }>(`/client/projects/${encoded}`),
      apiGet<{ history: ProjectHistoryEntry[] }>(`/client/projects/${encoded}/status-history`),
    ])
      .then(([projectRes, historyRes]) => {
        if (cancelled) return
        if (projectRes.success && projectRes.data && historyRes.success) {
          setState({ phase: 'ready', project: projectRes.data.project, history: historyRes.data?.history ?? [] })
          return
        }
        const failed = projectRes.success ? historyRes : projectRes
        if (!failed.success) {
          if (failed.status === 401) onUnauthorized()
          else if (failed.status === 404) setState({ phase: 'error', notFound: true, message: 'We couldn’t find that project.' })
          else setState({ phase: 'error', message: failed.message })
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ phase: 'error', message: err instanceof ApiNetworkError ? err.message : 'Failed to load this project.' })
      })

    return () => {
      cancelled = true
    }
  }, [id, onUnauthorized])

  const back = (
    <Link to={CLIENT_HOME} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
      My Projects
    </Link>
  )

  if (state.phase === 'loading') {
    return (
      <div>
        {back}
        <div className="mt-6 space-y-4" aria-hidden="true">
          <div className="h-10 w-2/3 animate-pulse rounded-[var(--radius-field)] bg-white/[0.04]" />
          <div className="h-40 animate-pulse rounded-[var(--radius-panel)] bg-white/[0.04]" />
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div>
        {back}
        <div className="mt-6 space-y-4">
          <ErrorState message={state.message} />
          {state.notFound ? <Button href={CLIENT_HOME}>Go to My Projects</Button> : null}
        </div>
      </div>
    )
  }

  const { project, history } = state
  // For a project on hold/cancelled: how far it genuinely got, from its real history.
  const reachedIndex = Math.max(0, ...history.map((entry) => stageIndex(entry.newStatus)))

  return (
    <div>
      {back}

      <header className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">
            {project.projectNumber} · {projectTypeLabel(project.projectType)}
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{project.projectName}</h1>
        </div>
        <ProjectStatusBadge status={project.status} />
      </header>

      <section aria-labelledby="progress" className="mt-8 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <h2 id="progress" className="sr-only">
          Progress
        </h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          <span className="font-medium text-[var(--color-ink)]">Current status: {statusLabel(project.status)}.</span>{' '}
          {STATUS_DESCRIPTIONS[project.status]}
        </p>
        <div className="mt-6">
          <StatusTimeline status={project.status} reachedIndex={reachedIndex} />
        </div>
        <p className="mt-6 border-t border-white/[0.06] pt-4 text-xs text-[var(--color-ink-faint)]">
          Submitted {formatDate(project.createdAt)} · Last updated {formatDate(project.updatedAt)}
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="details" className="space-y-6">
          <h2 id="details" className="text-lg font-semibold">
            Project details
          </h2>
          <Detail label="Description">{project.description}</Detail>
          {project.requiredFeatures ? <Detail label="Required features">{project.requiredFeatures}</Detail> : null}
          {project.targetAudience ? <Detail label="Target audience">{project.targetAudience}</Detail> : null}
          {project.additionalNotes ? <Detail label="Additional notes">{project.additionalNotes}</Detail> : null}

          <dl className="grid gap-x-6 gap-y-4 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5 sm:grid-cols-2">
            <MiniDetail label="Project type">{projectTypeLabel(project.projectType)}</MiniDetail>
            <MiniDetail label="Budget">{project.budgetRange}</MiniDetail>
            <MiniDetail label="Timeline">{timelineLabel(project.timeline)}</MiniDetail>
            <MiniDetail label="Current website">
              {project.websiteUrl ? (
                isSafeHttpUrl(project.websiteUrl) ? (
                  <a
                    href={project.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-[var(--color-accent)] hover:underline"
                  >
                    {project.websiteUrl}
                  </a>
                ) : (
                  <span className="break-all">{project.websiteUrl}</span>
                )
              ) : null}
            </MiniDetail>
          </dl>
        </section>

        <section aria-labelledby="history">
          <h2 id="history" className="text-lg font-semibold">
            Status history
          </h2>
          <ol className="mt-4 space-y-5 border-l border-white/[0.1] pl-5">
            {[...history].reverse().map((entry) => (
              <li key={entry.id} className="relative">
                <span aria-hidden="true" className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                <p className="text-xs text-[var(--color-ink-faint)]">{formatDate(entry.createdAt, true)}</p>
                <p className="mt-0.5 text-sm font-medium">{entry.oldStatus === null ? 'Project submitted' : statusLabel(entry.newStatus)}</p>
                {entry.message && entry.oldStatus !== null ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--color-ink-muted)]">{entry.message}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</h3>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-ink)]">{children}</p>
    </div>
  )
}

function MiniDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || <span className="text-[var(--color-ink-faint)]">Not provided</span>}</dd>
    </div>
  )
}

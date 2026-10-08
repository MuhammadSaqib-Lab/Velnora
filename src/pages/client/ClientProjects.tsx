import { ArrowRight, CheckCircle2, FolderPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ProjectStatusBadge, StatusTimeline } from '@/components/client/ProjectStatus'
import { ErrorState } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { apiGet, ApiNetworkError } from '@/lib/api'
import { formatDate, projectTypeLabel, STATUS_DESCRIPTIONS, type ClientProject } from '@/lib/projects'
import { NEW_PROJECT_PATH } from '@/lib/useClientSession'
import { useClientOutlet } from './useClientOutlet'

/**
 * "My Projects" — the client's own projects only (the API scopes the
 * query to the logged-in client; nothing here filters by an id the
 * browser supplies). Shows each project's REAL status and a stepped
 * journey; there is deliberately no percentage-complete anywhere, since
 * no real progress metric exists.
 */
export function ClientProjects() {
  const { client, onUnauthorized } = useClientOutlet()
  const location = useLocation()
  const submitted = (location.state as { submitted?: string } | null)?.submitted

  const [projects, setProjects] = useState<ClientProject[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<{ projects: ClientProject[] }>('/client/projects')
      .then((res) => {
        if (cancelled) return
        if (res.success) setProjects(res.data?.projects ?? [])
        else if (res.status === 401) onUnauthorized()
        else setError(res.message)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiNetworkError ? err.message : 'Failed to load your projects.')
      })
    return () => {
      cancelled = true
    }
  }, [onUnauthorized])

  const firstName = client.name.trim().split(/\s+/)[0]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Projects</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
            Welcome{firstName ? `, ${firstName}` : ''}. Here is where each of your projects stands.
          </p>
        </div>
      </div>

      {submitted ? (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-[var(--radius-panel)] border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-4 py-3.5"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
          <div className="text-sm">
            <p className="font-medium text-[var(--color-ink)]">Your project request has been received.</p>
            <p className="mt-0.5 text-[var(--color-ink-muted)]">
              Project {submitted} is below. We&apos;ll review it and update its status here.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        {error ? (
          <ErrorState message={error} />
        ) : projects === null ? (
          <div className="space-y-4" aria-hidden="true">
            {[0, 1].map((n) => (
              <div key={n} className="h-44 animate-pulse rounded-[var(--radius-panel)] bg-white/[0.04]" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-panel)] border border-dashed border-white/[0.14] px-6 py-14 text-center">
            <FolderPlus className="h-7 w-7 text-[var(--color-accent)]" strokeWidth={1.5} />
            <h2 className="mt-4 text-lg font-semibold">No projects yet</h2>
            <p className="mt-1.5 max-w-sm text-sm text-[var(--color-ink-muted)]">
              Tell us what you want to build and you&apos;ll be able to follow it from request to launch right here.
            </p>
            <Button href={NEW_PROJECT_PATH} className="mt-6">
              Start a project
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        ) : (
          <ul className="space-y-5">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} highlighted={project.projectNumber === submitted} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, highlighted }: { project: ClientProject; highlighted: boolean }) {
  return (
    <article
      className={
        highlighted
          ? 'rounded-[var(--radius-panel)] border border-[var(--color-accent)]/40 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.12)] sm:p-6'
          : 'rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">
            {project.projectNumber} · {projectTypeLabel(project.projectType)}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            <Link
              to={`/client/projects/${project.id}`}
              className="break-words hover:text-[var(--color-accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {project.projectName}
            </Link>
          </h2>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{STATUS_DESCRIPTIONS[project.status]}</p>

      <div className="mt-6">
        <StatusTimeline status={project.status} compact />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4 text-xs text-[var(--color-ink-faint)]">
        <p>
          Submitted {formatDate(project.createdAt)} · Last updated {formatDate(project.updatedAt)}
        </p>
        <Link
          to={`/client/projects/${project.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          View details
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </article>
  )
}

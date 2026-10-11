import { CardSkeleton } from '@/components/internal/States'
import { useResource, type Integration } from '@/lib/marketing'
import { LoadError, PageHeader, Panel, Tag } from './ui'

const STATUS_TEXT: Record<Integration['status'], { text: string; tone: 'good' | 'neutral' | 'warn' }> = {
  CONFIGURED: { text: 'Configured', tone: 'good' },
  AVAILABLE: { text: 'Available', tone: 'good' },
  NOT_CONNECTED: { text: 'Not connected', tone: 'warn' },
}

export function MarketingIntegrations() {
  const { data, error, loading, reload } = useResource<{ integrations: Integration[] }>('/admin/marketing/integrations')

  if (loading && !data) return <CardSkeleton count={4} />
  if (error || !data) return <LoadError message={error ?? 'Failed to load integrations.'} onRetry={reload} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="What the Digital Marketing agent can really reach. A service is only shown as connected when its credentials exist on the backend. Missing services are listed honestly — no data from them is ever displayed or estimated."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.integrations.map((integration) => {
          const status = STATUS_TEXT[integration.status]
          return (
            <Panel key={integration.key}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{integration.name}</h3>
                <div className="flex gap-2">
                  <Tag tone={status.tone}>{status.text}</Tag>
                  {!integration.supported ? <Tag>No connector yet</Tag> : null}
                </div>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{integration.purpose}</p>
              <p className="mt-3 text-sm">{integration.detail}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">Setup steps</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--color-ink-muted)]">
                  {integration.setupSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>
            </Panel>
          )
        })}
      </div>
      <p className="text-xs text-[var(--color-ink-faint)]">Credentials are set as environment variables on the backend and are never shown here or sent to the browser.</p>
    </div>
  )
}

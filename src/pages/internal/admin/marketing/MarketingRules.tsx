import { Lock } from 'lucide-react'
import { AgentConfigCard } from '../AgentSettings'
import { useResource } from '@/lib/marketing'
import { PageHeader, Panel } from './ui'

/**
 * Rules & Instructions for the Digital Marketing agent. Reuses the exact
 * editor the other two agents use (one card, one endpoint:
 * /api/admin/agents/digital-marketing/config), so versioning, restore and
 * the optimistic-concurrency check behave identically. The hard restrictions
 * shown below are read from the backend, not typed here.
 */
export function MarketingRules() {
  const settings = useResource<{ hardRestrictions: string[] }>('/admin/marketing/settings')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rules & instructions"
        description="Edit how the Digital Marketing agent writes and plans: brand voice, services to emphasise, content style and your own do's and don'ts. Saved versions are kept and can be restored."
      />

      <Panel title="Cannot be changed here" hint="These are enforced by the backend, above anything written in the editor below.">
        <ul className="space-y-2 text-sm">
          {(settings.data?.hardRestrictions ?? []).map((rule) => (
            <li key={rule} className="flex items-start gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
              <span>{rule}</span>
            </li>
          ))}
          {settings.loading && !settings.data ? <li className="text-[var(--color-ink-faint)]">Loading…</li> : null}
          {settings.error ? <li className="text-red-300">{settings.error}</li> : null}
        </ul>
      </Panel>

      <AgentConfigCard slug="digital-marketing" label="Digital Marketing" blurb="Brand voice, services, style and workflow for SEO, social content, strategy and campaigns." />
    </div>
  )
}

import { ShieldCheck } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/internal/admin/marketing', label: 'Overview', end: true },
  { to: '/internal/admin/marketing/seo', label: 'SEO Workspace', end: false },
  { to: '/internal/admin/marketing/social', label: 'Social Studio', end: false },
  { to: '/internal/admin/marketing/strategy', label: 'Strategy', end: false },
  { to: '/internal/admin/marketing/campaigns', label: 'Campaigns', end: false },
  { to: '/internal/admin/marketing/acquisition', label: 'Client Acquisition', end: false },
  { to: '/internal/admin/marketing/rules', label: 'Rules & Instructions', end: false },
  { to: '/internal/admin/marketing/integrations', label: 'Integrations', end: false },
  { to: '/internal/admin/marketing/tasks', label: 'Task History', end: false },
  { to: '/internal/admin/marketing/settings', label: 'Settings', end: false },
]

/**
 * Shell for the Digital Marketing workspace inside the Admin Dashboard. The
 * agent only prepares drafts, reports and plans for a human to review: the
 * banner states that up front, and the backend enforces it (there is no
 * route anywhere that publishes, sends or spends).
 */
export function MarketingLayout() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Digital Marketing</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">SEO audits, social content, strategy and campaign planning — drafts and recommendations for you to review.</p>

      <div role="note" className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-panel)] border border-[var(--color-accent)]/25 bg-[var(--color-accent-dim)] px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
        <span>Nothing here is published, sent or paid for automatically. Approving a draft or activating a campaign only records your decision.</span>
      </div>

      <nav aria-label="Digital Marketing sections" className="mt-5 -mx-1 overflow-x-auto border-b border-white/[0.08]">
        <ul className="flex min-w-max gap-1 px-1">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    '-mb-px block border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                    isActive ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                  )
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  )
}

import { Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { fieldInputClass, selectFieldClass } from '@/components/ui/fieldStyles'
import { useTaskRunner } from '@/lib/marketing'
import { cn } from '@/lib/utils'
import { PlanWorkspace } from './PlanWorkspace'
import { FormRow, OutcomeNotice, PageHeader, Panel, Spinner } from './ui'

export function MarketingStrategies() {
  const [goal, setGoal] = useState('')
  const [audience, setAudience] = useState('')
  const [market, setMarket] = useState('')
  const [budgetNote, setBudgetNote] = useState('')
  const [horizon, setHorizon] = useState<'WEEKLY' | 'MONTHLY' | 'QUARTERLY'>('MONTHLY')
  const [notes, setNotes] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const { run, running, outcome } = useTaskRunner()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = { goal: goal.trim(), horizon }
    if (audience.trim()) body.audience = audience.trim()
    if (market.trim()) body.market = market.trim()
    if (budgetNote.trim()) body.budgetNote = budgetNote.trim()
    if (notes.trim()) body.notes = notes.trim()
    if (await run('/admin/marketing/strategies/generate', body)) setRefreshKey((n) => n + 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing strategy"
        description="Turn a goal into a prioritized plan. Plans separate what is verified from assumptions and estimates, and never promise results. Approving a plan records your decision — it doesn’t start anything."
      />

      <Panel title="Generate a strategy" hint="If you’ve run an SEO audit on Velnora’s own site, its verified findings inform the plan. Nothing else is treated as verified.">
        <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
          <FormRow id="s-goal" label="Goal" hint="E.g. “Get 5 more qualified website-redesign enquiries a month”">
            <textarea id="s-goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} maxLength={600} className={cn(fieldInputClass, 'resize-y')} />
          </FormRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow id="s-audience" label="Audience" optional>
              <input id="s-audience" value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={400} className={fieldInputClass} />
            </FormRow>
            <FormRow id="s-market" label="Market / location" optional>
              <input id="s-market" value={market} onChange={(e) => setMarket(e.target.value)} maxLength={300} className={fieldInputClass} />
            </FormRow>
            <FormRow id="s-horizon" label="Planning horizon">
              <select id="s-horizon" value={horizon} onChange={(e) => setHorizon(e.target.value as typeof horizon)} className={selectFieldClass}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </FormRow>
            <FormRow id="s-budget" label="Budget note" optional hint="Context only. The agent never spends or changes ads.">
              <input id="s-budget" value={budgetNote} onChange={(e) => setBudgetNote(e.target.value)} maxLength={300} className={fieldInputClass} />
            </FormRow>
          </div>
          <FormRow id="s-notes" label="Anything else" optional>
            <textarea id="s-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={cn(fieldInputClass, 'resize-y')} />
          </FormRow>
          <Button type="submit" disabled={running || goal.trim().length < 3}>
            {running ? <Spinner /> : <Sparkles className="h-4 w-4" strokeWidth={1.75} />} {running ? 'Generating…' : 'Generate strategy'}
          </Button>
          <OutcomeNotice outcome={outcome} />
        </form>
      </Panel>

      <PlanWorkspace kinds={['STRATEGY', 'SEO_PLAN']} refreshKey={refreshKey} emptyText="No plans yet — generate one above, or create an SEO plan from the SEO Workspace." />
    </div>
  )
}

import { Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { ACQUISITION_CATEGORIES, label, useTaskRunner } from '@/lib/marketing'
import { cn } from '@/lib/utils'
import { PlanWorkspace } from './PlanWorkspace'
import { ChipSelect, FormRow, Notice, OutcomeNotice, PageHeader, Panel, Spinner } from './ui'

export function ClientAcquisition() {
  const [categories, setCategories] = useState<Array<(typeof ACQUISITION_CATEGORIES)[number]>>(['INBOUND_CONTENT', 'LOCAL_SEO'])
  const [service, setService] = useState('')
  const [niche, setNiche] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const { run, running, outcome } = useTaskRunner()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = { categories }
    if (service.trim()) body.service = service.trim()
    if (niche.trim()) body.niche = niche.trim()
    if (location.trim()) body.location = location.trim()
    if (notes.trim()) body.notes = notes.trim()
    if (await run('/admin/marketing/acquisition/generate', body)) setRefreshKey((n) => n + 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client acquisition"
        description="Ideas for attracting the right clients to Velnora: content, local SEO, partnerships and positioning. This is planning only — it doesn’t find, contact or message anyone."
      />

      <Notice tone="info">
        Looking for specific businesses to approach? That’s the{' '}
        <Link to="/internal/admin/lead-finder" className="text-[var(--color-accent)] underline">
          Lead Finder
        </Link>
        , a separate tool. The Digital Marketing agent has no access to leads, contacts or email, and never sends unsolicited outreach.
      </Notice>

      <Panel title="Generate an acquisition plan" hint="Choose the approaches you want ideas for.">
        <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
          <div>
            <p className="mb-2 text-sm font-medium">Approaches</p>
            <ChipSelect options={ACQUISITION_CATEGORIES} value={categories} onChange={setCategories} labelFor={label} legend="Approaches" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow id="a-service" label="Service to promote" optional>
              <input id="a-service" value={service} onChange={(e) => setService(e.target.value)} maxLength={200} className={fieldInputClass} />
            </FormRow>
            <FormRow id="a-niche" label="Target niche" optional>
              <input id="a-niche" value={niche} onChange={(e) => setNiche(e.target.value)} maxLength={200} className={fieldInputClass} />
            </FormRow>
            <FormRow id="a-location" label="Location" optional>
              <input id="a-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} className={fieldInputClass} />
            </FormRow>
          </div>
          <FormRow id="a-notes" label="Anything else" optional>
            <textarea id="a-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={cn(fieldInputClass, 'resize-y')} />
          </FormRow>
          <Button type="submit" disabled={running || categories.length === 0}>
            {running ? <Spinner /> : <Sparkles className="h-4 w-4" strokeWidth={1.75} />} {running ? 'Generating…' : 'Generate plan'}
          </Button>
          <OutcomeNotice outcome={outcome} />
        </form>
      </Panel>

      <PlanWorkspace kinds={['ACQUISITION']} refreshKey={refreshKey} emptyText="No acquisition plans yet — generate one above." />
    </div>
  )
}

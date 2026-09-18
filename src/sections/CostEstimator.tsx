import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import {
  designOptions,
  projectTypeOptions,
  speedOptions,
  toContactProjectType,
  type DesignValue,
  type ProjectTypeValue,
  type SpeedValue,
} from '@/data/estimator'
import { requestEstimateHandoff } from '@/lib/estimateHandoff'
import { cn } from '@/lib/utils'

interface OptionCardProps {
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

function OptionCard({ label, description, selected, onSelect }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-[var(--radius-field)] border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent-dim)]'
          : 'border-white/[0.1] bg-white/[0.02] hover:border-white/[0.25]',
      )}
    >
      <p
        className={cn(
          'text-sm font-medium',
          selected ? 'text-[var(--color-accent-soft)]' : 'text-[var(--color-ink)]',
        )}
      >
        {label}
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{description}</p>
    </button>
  )
}

export function CostEstimator() {
  const [projectType, setProjectType] = useState<ProjectTypeValue>('landing')
  const [design, setDesign] = useState<DesignValue>('custom')
  const [speed, setSpeed] = useState<SpeedValue>('standard')

  function handleRequestEstimate() {
    const projectLabel = projectTypeOptions.find((o) => o.value === projectType)!.label
    const designLabel = designOptions.find((o) => o.value === design)!.label
    const speedLabel = speedOptions.find((o) => o.value === speed)!.label

    // No price is ever computed or passed along here — the client's own
    // Contact form budget field (now free text) is where they say what
    // they're comfortable with, not something this estimator states for them.
    requestEstimateHandoff({
      projectType: toContactProjectType(projectType),
      budget: '',
      message: `Cost estimate request: ${projectLabel}, ${designLabel.toLowerCase()}, ${speedLabel.toLowerCase()}.`,
    })
  }

  return (
    <section id="estimate" className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          heading="See a live estimate for your project"
          subtext="Answer three quick questions for a ballpark range. We'll confirm specifics on a discovery call."
          align="center"
        />

        <Reveal className="mx-auto mt-14 max-w-4xl">
          <GlassPanel className="p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">Project type</p>
                <div className="mt-3 flex flex-col gap-2">
                  {projectTypeOptions.map((option) => (
                    <OptionCard
                      key={option.value}
                      label={option.label}
                      description={option.description}
                      selected={projectType === option.value}
                      onSelect={() => setProjectType(option.value)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">Design needs</p>
                <div className="mt-3 flex flex-col gap-2">
                  {designOptions.map((option) => (
                    <OptionCard
                      key={option.value}
                      label={option.label}
                      description={option.description}
                      selected={design === option.value}
                      onSelect={() => setDesign(option.value)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">Delivery speed</p>
                <div className="mt-3 flex flex-col gap-2">
                  {speedOptions.map((option) => (
                    <OptionCard
                      key={option.value}
                      label={option.label}
                      description={option.description}
                      selected={speed === option.value}
                      onSelect={() => setSpeed(option.value)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center border-t border-white/[0.08] pt-8">
              <Button href="#contact" size="lg" onClick={handleRequestEstimate}>
                Request this estimate
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
          </GlassPanel>
        </Reveal>
      </div>
    </section>
  )
}

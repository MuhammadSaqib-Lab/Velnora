import { motion, useReducedMotion } from 'motion/react'
import { Gauge, Search, TrendingUp } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'

const cards = [
  { icon: TrendingUp, label: 'Organic traffic', value: '+', className: 'left-[6%] top-[12%]' },
  { icon: Gauge, label: 'Load time', value: 'fast', className: 'right-[4%] top-[38%]' },
  { icon: Search, label: 'Search visibility', value: 'up', className: 'left-[14%] bottom-[10%]' },
]

/**
 * Static/CSS visual for devices without WebGL, low-power hardware, or
 * prefers-reduced-motion. Communicates the same "AI network / growth"
 * idea without a 3D render pipeline.
 */
export function SceneFallback() {
  const reduce = useReducedMotion()

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-56 w-56 rounded-full bg-[var(--color-accent-strong)]/20 blur-3xl md:h-72 md:w-72" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-40 w-40 rounded-full border border-[var(--color-accent)]/30 md:h-48 md:w-48" />
      </div>

      {cards.map(({ icon: Icon, label, value, className }, i) => (
        <motion.div
          key={label}
          className={`absolute hidden sm:block ${className}`}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1] }}
        >
          <GlassPanel className="flex items-center gap-3 px-4 py-3">
            <Icon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
            <div>
              <p className="text-[11px] text-[var(--color-ink-faint)]">{label}</p>
              <p className="font-mono text-sm text-[var(--color-ink)]">{value}</p>
            </div>
          </GlassPanel>
        </motion.div>
      ))}
    </div>
  )
}

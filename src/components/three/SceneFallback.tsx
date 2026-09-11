import { motion, useReducedMotion } from 'motion/react'
import { services } from '@/data/services'

const RADIUS_PERCENT = 40

/**
 * Static/CSS visual for devices without WebGL, low-power hardware, or
 * prefers-reduced-motion. Mirrors the real 3D scene's orbiting service
 * badges, but placed at fixed positions rather than continuously
 * animated, since this path is specifically for lower-power devices.
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

      {services.map((service, i) => {
        const angle = (i / services.length) * Math.PI * 2 - Math.PI / 2
        const left = 50 + RADIUS_PERCENT * Math.cos(angle)
        const top = 50 + RADIUS_PERCENT * Math.sin(angle)
        const Icon = service.icon

        return (
          <motion.div
            key={service.title}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%`, top: `${top}%` }}
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-canvas)]/85 px-2.5 py-1 text-[9px] font-medium text-[var(--color-accent-soft)] shadow-[0_0_18px_-6px_rgba(16,185,129,0.6)] backdrop-blur-sm sm:px-3 sm:py-1.5 sm:text-[11px]">
              <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
              {service.title}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

import { useEffect, useRef } from 'react'

const BAR_COUNT = 24

/**
 * A small bar-style waveform driven by a live 0-1 level ref (mic input
 * while listening, reply amplitude while speaking) — read directly via
 * requestAnimationFrame rather than React state, matching the rest of
 * this feature's ref-based audio pattern (see useAudioAnalyser.ts) so
 * it doesn't force a re-render every frame. Idle state renders a flat,
 * gently breathing baseline instead of fabricating activity.
 */
export function Waveform({ levelRef, active }: { levelRef: React.RefObject<number>; active: boolean }) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const phasesRef = useRef(Array.from({ length: BAR_COUNT }, (_, i) => i * 0.35))

  useEffect(() => {
    let raf: number
    let t = 0

    const tick = () => {
      t += 0.05
      const level = active ? levelRef.current : 0
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const bar = barRefs.current[i]
        if (!bar) continue
        const idle = 0.12 + Math.sin(t + phasesRef.current[i]) * 0.04
        const reactive = level * (0.4 + Math.sin(t * 3 + phasesRef.current[i]) * 0.6)
        const height = active ? Math.max(0.08, Math.min(1, idle * 0.3 + reactive)) : idle
        bar.style.transform = `scaleY(${height})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, levelRef])

  return (
    <div className="flex h-6 items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el
          }}
          className="h-full w-[2.5px] rounded-full bg-[var(--color-accent)]/70 transition-opacity"
          style={{ transform: 'scaleY(0.12)' }}
        />
      ))}
    </div>
  )
}

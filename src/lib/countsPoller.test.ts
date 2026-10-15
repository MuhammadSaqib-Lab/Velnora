import { describe, expect, it } from 'vitest'
import { CountsPoller, type LoadOutcome, type PollerEnvironment, type PollerState } from './countsPoller'

/** A hand-driven clock + tab-visibility + change-event source, so every timing claim is checked exactly. */
class FakeEnv implements PollerEnvironment {
  hidden = false
  time = 1_000_000
  private nextId = 1
  private timers = new Map<number, { at: number; callback: () => void }>()
  visibilityListeners = new Set<() => void>()
  changeListeners = new Set<() => void>()

  isHidden() {
    return this.hidden
  }
  onVisibilityChange(listener: () => void) {
    this.visibilityListeners.add(listener)
    return () => this.visibilityListeners.delete(listener)
  }
  onDataChanged(listener: () => void) {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }
  now() {
    return this.time
  }
  setTimer(callback: () => void, ms: number) {
    const id = this.nextId++
    this.timers.set(id, { at: this.time + ms, callback })
    return id
  }
  clearTimer(handle: unknown) {
    this.timers.delete(handle as number)
  }

  get pendingTimers() {
    return this.timers.size
  }
  /** Moves time forward, firing due timers in order and letting the promises they start settle. */
  async advance(ms: number) {
    const target = this.time + ms
    for (;;) {
      const due = [...this.timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      this.time = due[1].at
      this.timers.delete(due[0])
      due[1].callback()
      await settle()
    }
    this.time = target
    await settle()
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden
    for (const listener of [...this.visibilityListeners]) listener()
  }
  announceChange() {
    for (const listener of [...this.changeListeners]) listener()
  }
}

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

interface Harness {
  env: FakeEnv
  poller: CountsPoller<number>
  states: PollerState<number>[]
  calls: Array<{ signal: AbortSignal; resolve: (o: LoadOutcome<number>) => void; reject: (e: unknown) => void }>
  unauthorized: { count: number }
  maxConcurrent: () => number
}

function harness(options: { intervalMs?: number; autoAnswer?: boolean } = {}): Harness {
  const env = new FakeEnv()
  const states: PollerState<number>[] = []
  const calls: Harness['calls'] = []
  const unauthorized = { count: 0 }
  let running = 0
  let peak = 0
  let counter = 0
  const poller = new CountsPoller<number>({
    env,
    intervalMs: options.intervalMs ?? 60_000,
    load: (signal) =>
      new Promise<LoadOutcome<number>>((resolve, reject) => {
        running += 1
        peak = Math.max(peak, running)
        const finish = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
          running -= 1
          fn(...a)
        }
        const entry = { signal, resolve: finish(resolve), reject: finish(reject) }
        calls.push(entry)
        if (options.autoAnswer !== false) {
          counter += 1
          entry.resolve({ kind: 'ok', data: counter })
        }
      }),
    onState: (s) => states.push(s),
    onUnauthorized: () => {
      unauthorized.count += 1
    },
  })
  return { env, poller, states, calls, unauthorized, maxConcurrent: () => peak }
}

describe('CountsPoller — periodic refresh', () => {
  it('loads immediately, then every interval while the tab is visible', async () => {
    const h = harness()
    h.poller.start()
    await settle()
    expect(h.calls).toHaveLength(1)
    expect(h.states.at(-1)).toMatchObject({ data: 1, status: 'ready' })

    await h.env.advance(59_999)
    expect(h.calls).toHaveLength(1)
    await h.env.advance(1)
    expect(h.calls).toHaveLength(2)
    await h.env.advance(60_000)
    expect(h.calls).toHaveLength(3)
    expect(h.states.at(-1)).toMatchObject({ data: 3, status: 'ready' })
    h.poller.stop()
  })

  it('does not even start while the tab is hidden, and loads when it becomes visible', async () => {
    const h = harness()
    h.env.hidden = true
    h.poller.start()
    await h.env.advance(10 * 60_000)
    expect(h.calls).toHaveLength(0)
    h.env.setHidden(false)
    await settle()
    expect(h.calls).toHaveLength(1)
    h.poller.stop()
  })
})

describe('CountsPoller — pausing in a hidden tab', () => {
  it('makes no requests and keeps no timer while hidden, however long it stays hidden', async () => {
    const h = harness()
    h.poller.start()
    await settle()
    h.env.setHidden(true)
    expect(h.env.pendingTimers).toBe(0)
    await h.env.advance(30 * 60_000)
    expect(h.calls).toHaveLength(1)
    h.poller.stop()
  })

  it('refreshes at once on return when the data went stale, and resumes the schedule', async () => {
    const h = harness()
    h.poller.start()
    await settle()
    h.env.setHidden(true)
    await h.env.advance(5 * 60_000)
    h.env.setHidden(false)
    await settle()
    expect(h.calls).toHaveLength(2)
    await h.env.advance(60_000)
    expect(h.calls).toHaveLength(3)
    h.poller.stop()
  })

  it('does not refetch on a quick glance away and back (data still fresh)', async () => {
    const h = harness()
    h.poller.start()
    await settle()
    await h.env.advance(5_000)
    h.env.setHidden(true)
    h.env.setHidden(false)
    await settle()
    expect(h.calls).toHaveLength(1)
    expect(h.env.pendingTimers).toBe(1) // the normal schedule is back (a full interval from now)
    await h.env.advance(59_999)
    expect(h.calls).toHaveLength(1)
    await h.env.advance(1)
    expect(h.calls).toHaveLength(2)
    h.poller.stop()
  })

  it('an admin action while hidden is picked up the moment the tab returns', async () => {
    const h = harness()
    h.poller.start()
    await settle()
    h.env.setHidden(true)
    h.env.announceChange()
    await h.env.advance(1_000)
    expect(h.calls).toHaveLength(1) // nothing while hidden
    h.env.setHidden(false)
    await settle()
    expect(h.calls).toHaveLength(2) // fresh by clock, but something changed
    h.poller.stop()
  })
})

describe('CountsPoller — no duplicate requests', () => {
  it('never runs two requests at once, and coalesces a burst of refreshes into one follow-up', async () => {
    const h = harness({ autoAnswer: false })
    h.poller.start()
    await settle()
    expect(h.calls).toHaveLength(1)

    for (let i = 0; i < 6; i++) h.poller.refresh() // the first is still running
    await settle()
    expect(h.calls).toHaveLength(1)

    h.calls[0]!.resolve({ kind: 'ok', data: 1 })
    await settle()
    expect(h.calls).toHaveLength(2) // exactly one follow-up
    h.calls[1]!.resolve({ kind: 'ok', data: 2 })
    await settle()
    expect(h.calls).toHaveLength(2)
    expect(h.maxConcurrent()).toBe(1)
    h.poller.stop()
  })

  it('a change that lands while a request is running triggers a fresh one (the running one may predate it)', async () => {
    const h = harness({ autoAnswer: false })
    h.poller.start()
    await settle()
    h.env.announceChange()
    await h.env.advance(400)
    expect(h.calls).toHaveLength(1)
    h.calls[0]!.resolve({ kind: 'ok', data: 1 })
    await settle()
    expect(h.calls).toHaveLength(2)
    h.calls[1]!.resolve({ kind: 'ok', data: 2 })
    await settle()
    h.poller.stop()
  })

  it('turns a burst of admin actions into one refresh', async () => {
    const h = harness()
    h.poller.start()
    await settle()
    for (let i = 0; i < 5; i++) {
      h.env.announceChange()
      await h.env.advance(100)
    }
    expect(h.calls).toHaveLength(1) // still debouncing
    await h.env.advance(400)
    expect(h.calls).toHaveLength(2)
    h.poller.stop()
  })

  it('start() twice does not start two pollers', async () => {
    const h = harness()
    h.poller.start()
    h.poller.start()
    await settle()
    expect(h.calls).toHaveLength(1)
    expect(h.env.visibilityListeners.size).toBe(1)
    h.poller.stop()
  })
})

describe('CountsPoller — failures', () => {
  it('keeps the last good numbers, reports an error, and backs off instead of hammering the server', async () => {
    const h = harness({ autoAnswer: false })
    h.poller.start()
    await settle()
    h.calls[0]!.resolve({ kind: 'ok', data: 7 })
    await settle()
    expect(h.states.at(-1)).toMatchObject({ data: 7, status: 'ready' })

    await h.env.advance(60_000)
    h.calls[1]!.reject(new Error('network down'))
    await settle()
    expect(h.states.at(-1)).toMatchObject({ data: 7, status: 'error' }) // not zeros, not blank

    await h.env.advance(119_999) // 1st failure → wait 2×
    expect(h.calls).toHaveLength(2)
    await h.env.advance(1)
    expect(h.calls).toHaveLength(3)
    h.calls[2]!.reject(new Error('still down'))
    await settle()
    await h.env.advance(239_999) // 2nd failure → 4×
    expect(h.calls).toHaveLength(3)
    await h.env.advance(1)
    expect(h.calls).toHaveLength(4)
    h.calls[3]!.reject(new Error('still down'))
    await settle()
    await h.env.advance(300_000) // 3rd failure → capped at 5 min
    expect(h.calls).toHaveLength(5)

    h.calls[4]!.resolve({ kind: 'ok', data: 9 }) // recovery
    await settle()
    expect(h.states.at(-1)).toMatchObject({ data: 9, status: 'ready' })
    await h.env.advance(60_000) // back to the normal interval
    expect(h.calls).toHaveLength(6)
    h.poller.stop()
  })

  it('has no data (null), not 0, if the very first load fails', async () => {
    const h = harness({ autoAnswer: false })
    h.poller.start()
    await settle()
    h.calls[0]!.reject(new Error('boom'))
    await settle()
    expect(h.states.at(-1)).toEqual({ data: null, status: 'error', updatedAt: null })
    h.poller.stop()
  })

  it('stops polling and reports it when the session is gone (401)', async () => {
    const h = harness({ autoAnswer: false })
    h.poller.start()
    await settle()
    h.calls[0]!.resolve({ kind: 'unauthorized' })
    await settle()
    expect(h.unauthorized.count).toBe(1)
    expect(h.env.pendingTimers).toBe(0)
    expect(h.env.visibilityListeners.size).toBe(0)
    h.env.announceChange()
    await h.env.advance(10 * 60_000)
    expect(h.calls).toHaveLength(1)
  })
})

describe('CountsPoller — cleanup', () => {
  it('stop() cancels the timer, aborts the running request, and removes every listener', async () => {
    const h = harness({ autoAnswer: false })
    h.poller.start()
    await settle()
    h.env.announceChange()
    expect(h.env.pendingTimers).toBeGreaterThan(0)
    h.poller.stop()
    expect(h.calls[0]!.signal.aborted).toBe(true)
    expect(h.env.pendingTimers).toBe(0)
    expect(h.env.visibilityListeners.size).toBe(0)
    expect(h.env.changeListeners.size).toBe(0)
  })

  it('reports nothing after stop(), even if a request finishes afterwards', async () => {
    const h = harness({ autoAnswer: false })
    h.poller.start()
    await settle()
    h.poller.stop()
    const before = h.states.length
    h.calls[0]!.resolve({ kind: 'ok', data: 99 })
    await settle()
    h.poller.refresh()
    await h.env.advance(10 * 60_000)
    expect(h.states).toHaveLength(before)
    expect(h.calls).toHaveLength(1)
  })
})

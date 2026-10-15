import { ADMIN_DATA_CHANGED } from '@/lib/adminEvents'

/**
 * Keeps a small piece of server state (the sidebar counts) fresh by periodic
 * polling — this is NOT a live push channel, and nothing should describe it
 * as real-time. Properties, each covered by tests:
 *
 *  - one request at a time: asking again while one is running coalesces into
 *    a single follow-up request (never two in parallel);
 *  - paused while the tab is hidden (no timer, no requests) and refreshed on
 *    return if the data went stale or an admin action happened meanwhile;
 *  - refreshes shortly after the admin changes something (a debounced event
 *    from the API layer), so a badge follows the admin's own actions at once;
 *  - failures keep the last good numbers, are reported as an error state, and
 *    back off exponentially instead of hammering a struggling backend;
 *  - a 401 stops polling and tells the owner the session is gone;
 *  - stop() cancels the timer, the in-flight request and every listener, and
 *    nothing is reported afterwards.
 */
export type PollerStatus = 'loading' | 'ready' | 'error'

export interface PollerState<T> {
  data: T | null
  status: PollerStatus
  /** When `data` was last fetched successfully (ms since epoch). */
  updatedAt: number | null
}

export type LoadOutcome<T> = { kind: 'ok'; data: T } | { kind: 'unauthorized' }

export interface PollerEnvironment {
  isHidden(): boolean
  /** Called when the tab's visibility changes. Returns an unsubscribe function. */
  onVisibilityChange(listener: () => void): () => void
  /** Called when the admin changed server data. Returns an unsubscribe function. */
  onDataChanged(listener: () => void): () => void
  now(): number
  setTimer(callback: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

export const browserEnvironment: PollerEnvironment = {
  isHidden: () => document.visibilityState === 'hidden',
  onVisibilityChange: (listener) => {
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  },
  onDataChanged: (listener) => {
    window.addEventListener(ADMIN_DATA_CHANGED, listener)
    return () => window.removeEventListener(ADMIN_DATA_CHANGED, listener)
  },
  now: () => Date.now(),
  setTimer: (callback, ms) => window.setTimeout(callback, ms),
  clearTimer: (handle) => window.clearTimeout(handle as number),
}

export interface PollerOptions<T> {
  load: (signal: AbortSignal) => Promise<LoadOutcome<T>>
  onState: (state: PollerState<T>) => void
  onUnauthorized?: () => void
  /** Time between polls while the tab is visible. */
  intervalMs?: number
  /** On returning to a hidden tab, refresh immediately if the last attempt is older than this. */
  staleAfterMs?: number
  /** Ceiling for the exponential back-off after failures. */
  maxBackoffMs?: number
  /** Coalesces a burst of admin actions into one refresh. */
  changeDebounceMs?: number
  env?: PollerEnvironment
}

export const DEFAULT_POLL_INTERVAL_MS = 60_000

export class CountsPoller<T> {
  private readonly load: PollerOptions<T>['load']
  private readonly onState: PollerOptions<T>['onState']
  private readonly onUnauthorized?: () => void
  private readonly intervalMs: number
  private readonly staleAfterMs: number
  private readonly maxBackoffMs: number
  private readonly changeDebounceMs: number
  private readonly env: PollerEnvironment

  private state: PollerState<T> = { data: null, status: 'loading', updatedAt: null }
  private started = false
  private stopped = false
  private failures = 0
  private pollTimer: unknown = null
  private changeTimer: unknown = null
  private inFlight: AbortController | null = null
  private rerunAfterFlight = false
  private dirtyWhileHidden = false
  private lastAttemptAt = 0
  private unsubscribers: Array<() => void> = []

  constructor(options: PollerOptions<T>) {
    this.load = options.load
    this.onState = options.onState
    this.onUnauthorized = options.onUnauthorized
    this.intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS
    this.staleAfterMs = options.staleAfterMs ?? this.intervalMs / 2
    this.maxBackoffMs = options.maxBackoffMs ?? 5 * 60_000
    this.changeDebounceMs = options.changeDebounceMs ?? 400
    this.env = options.env ?? browserEnvironment
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.unsubscribers.push(
      this.env.onVisibilityChange(() => this.handleVisibility()),
      this.env.onDataChanged(() => this.handleDataChanged()),
    )
    if (!this.env.isHidden()) void this.fetchNow()
  }

  stop(): void {
    this.stopped = true
    this.clearPollTimer()
    if (this.changeTimer !== null) this.env.clearTimer(this.changeTimer)
    this.changeTimer = null
    this.inFlight?.abort()
    this.inFlight = null
    for (const unsubscribe of this.unsubscribers) unsubscribe()
    this.unsubscribers = []
  }

  /** Ask for fresh data now. Safe to call at any time; never runs two requests at once. */
  refresh(): void {
    if (this.stopped) return
    if (this.env.isHidden()) {
      this.dirtyWhileHidden = true
      return
    }
    void this.fetchNow()
  }

  private emit(next: PollerState<T>): void {
    this.state = next
    if (!this.stopped) this.onState(next)
  }

  private clearPollTimer(): void {
    if (this.pollTimer !== null) this.env.clearTimer(this.pollTimer)
    this.pollTimer = null
  }

  private scheduleNext(): void {
    if (this.stopped || this.env.isHidden()) return
    this.clearPollTimer()
    const delay = this.failures === 0 ? this.intervalMs : Math.min(this.intervalMs * 2 ** this.failures, this.maxBackoffMs)
    this.pollTimer = this.env.setTimer(() => {
      this.pollTimer = null
      void this.fetchNow()
    }, delay)
  }

  private async fetchNow(): Promise<void> {
    if (this.stopped) return
    if (this.inFlight) {
      // A request is already running; remember to ask once more when it ends
      // (the running one may have started before the change that prompted this).
      this.rerunAfterFlight = true
      return
    }
    this.clearPollTimer()
    this.dirtyWhileHidden = false
    const controller = new AbortController()
    this.inFlight = controller
    this.lastAttemptAt = this.env.now()

    try {
      const outcome = await this.load(controller.signal)
      if (this.stopped || controller.signal.aborted) return
      if (outcome.kind === 'unauthorized') {
        this.stop()
        this.onUnauthorized?.()
        return
      }
      this.failures = 0
      this.emit({ data: outcome.data, status: 'ready', updatedAt: this.env.now() })
    } catch {
      if (this.stopped || controller.signal.aborted) return
      this.failures += 1
      // Keep the last good numbers; the status says they may be out of date.
      this.emit({ data: this.state.data, status: 'error', updatedAt: this.state.updatedAt })
    } finally {
      if (this.inFlight === controller) this.inFlight = null
    }

    if (this.stopped) return
    if (this.rerunAfterFlight) {
      this.rerunAfterFlight = false
      if (this.env.isHidden()) this.dirtyWhileHidden = true
      else void this.fetchNow()
      return
    }
    this.scheduleNext()
  }

  private handleVisibility(): void {
    if (this.stopped) return
    if (this.env.isHidden()) {
      // Nobody is looking: no timer, no new requests (one already running may finish).
      this.clearPollTimer()
      return
    }
    const stale = this.state.updatedAt === null || this.env.now() - this.lastAttemptAt >= this.staleAfterMs
    if (this.dirtyWhileHidden || stale) void this.fetchNow()
    else if (this.pollTimer === null && !this.inFlight) this.scheduleNext()
  }

  private handleDataChanged(): void {
    if (this.stopped) return
    if (this.changeTimer !== null) this.env.clearTimer(this.changeTimer)
    this.changeTimer = this.env.setTimer(() => {
      this.changeTimer = null
      this.refresh()
    }, this.changeDebounceMs)
  }
}

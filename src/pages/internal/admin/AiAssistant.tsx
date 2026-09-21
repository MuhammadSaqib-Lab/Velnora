import { AlertCircle, Mic, MicOff, Send, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AgentOrchestration } from '@/components/internal/aiAssistant/AgentOrchestration'
import { AgentTeam } from '@/components/internal/aiAssistant/AgentTeam'
import { AiFaceVisual } from '@/components/internal/aiAssistant/AiFaceVisual'
import type { AssistantState } from '@/components/internal/aiAssistant/assistantState'
import { LiveActivity } from '@/components/internal/aiAssistant/LiveActivity'
import { useAudioAnalyser } from '@/components/internal/aiAssistant/useAudioAnalyser'
import { useSpeechRecognition } from '@/components/internal/aiAssistant/useSpeechRecognition'
import { apiGet, apiPost, ApiNetworkError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AdminOverview } from './types'

interface SimulatedAction {
  action: string
  description: string
  params?: Record<string, unknown>
}

interface LogEntry {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  actions?: SimulatedAction[]
}

type ConnectionStatus = 'connecting' | 'online' | 'offline'

const STATE_LABEL: Record<AssistantState, string> = {
  idle: 'Idle',
  listening: 'Listening…',
  attentive: 'Attentive',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  working: 'Working…',
  success: 'Done',
  positive: 'Positive',
  concerned: 'Concerned',
  caution: 'Caution',
}

const GREETING: LogEntry = {
  id: 'greeting',
  role: 'assistant',
  text: "Hi — I'm your AI Operations Assistant. Ask about lead status, or tell me what you'd like the Lead Finder Agent to do and I'll preview the action here.",
}

/**
 * Admin-only AI Operations Center. Every "action" shown here is a
 * PREVIEW — see backend/src/aiAssistant/tools/simulateAgentAction.tool.ts
 * — this page never triggers a real Google Places search, website
 * analysis, or Gmail draft. Voice-transcribed, freeform commands
 * shouldn't directly spend API quota or touch Gmail without a human
 * reviewing the real action from the Lead Finder pages first.
 */
export function AiAssistant() {
  const [log, setLog] = useState<LogEntry[]>([GREETING])
  const [assistantState, setAssistantState] = useState<AssistantState>('idle')
  const [inputValue, setInputValue] = useState('')
  const [voiceUnavailableNotice, setVoiceUnavailableNotice] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [overviewStatus, setOverviewStatus] = useState<ConnectionStatus>('connecting')
  const [lastAction, setLastAction] = useState<{ action: string; at: number } | null>(null)

  const speech = useSpeechRecognition()
  const audio = useAudioAnalyser()
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<AdminOverview>('/admin/overview')
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setOverview(result.data)
          setOverviewStatus('online')
        } else {
          setOverviewStatus('offline')
        }
      })
      .catch(() => {
        if (cancelled) return
        setOverviewStatus('offline')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [log])

  // When the reply audio finishes, settle back to idle rather than
  // staying stuck on "speaking" — audio.isSpeaking is the real signal.
  const wasSpeaking = useRef(false)
  useEffect(() => {
    if (wasSpeaking.current && !audio.isSpeaking) {
      setAssistantState('idle')
    }
    wasSpeaking.current = audio.isSpeaking
  }, [audio.isSpeaking])

  const effectiveState: AssistantState = audio.isSpeaking ? 'speaking' : assistantState

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    setNetworkError(null)
    setLog((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    setAssistantState('thinking')

    try {
      const result = await apiPost<{ actions: SimulatedAction[] }>('/admin/ai-assistant/command', {
        message: trimmed,
        history: historyRef.current,
      })

      if (!result.success) {
        setLog((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', text: result.message }])
        setAssistantState(result.message.toLowerCase().includes('unauthorized') ? 'concerned' : 'caution')
        return
      }

      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, content: trimmed },
        { role: 'assistant' as const, content: result.message },
      ].slice(-20)

      const actions = result.data?.actions ?? []
      if (actions.length > 0) {
        setLastAction({ action: actions[0].action, at: Date.now() })
        setAssistantState('working')
      } else {
        setAssistantState('positive')
      }

      setLog((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: result.message, actions }])

      await speakReply(result.message)
    } catch (error) {
      setNetworkError(error instanceof ApiNetworkError ? error.message : 'Something went wrong. Please try again.')
      setAssistantState('concerned')
    }
  }

  async function speakReply(text: string) {
    try {
      const result = await apiPost<{ audioBase64: string; mimeType: string }>('/admin/ai-assistant/speak', { text })
      if (!result.success || !result.data) {
        // Voice output not configured is an expected, non-error state
        // (see backend/src/aiAssistant/elevenLabs.service.ts) — the text
        // reply already stands on its own, so this stays a quiet
        // one-line notice, not an error banner.
        setVoiceUnavailableNotice(result.message)
        setAssistantState('idle')
        return
      }
      setVoiceUnavailableNotice(null)
      audio.playBase64Audio(result.data.audioBase64, result.data.mimeType)
    } catch {
      setAssistantState('idle')
    }
  }

  function handleMicClick() {
    if (speech.isListening) {
      speech.stop()
      return
    }
    setAssistantState('listening')
    speech.start((finalText) => {
      setAssistantState('attentive')
      void sendMessage(finalText)
    })
  }

  function handleTextSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = inputValue
    setInputValue('')
    void sendMessage(text)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[var(--color-ink)]">AI Operations Assistant</h1>
            <span className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-accent)]">
              Orchestrator
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Your intelligent agency operations manager.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[260px_1fr_300px]">
        {/* LEFT — Agent Team (order-3 on mobile: comes after the center content) */}
        <div className="order-3 lg:order-1">
          <AgentTeam overview={overview} status={overviewStatus} />
        </div>

        {/* CENTER — Face + state + orchestration (order-1 on mobile: highest priority) */}
        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <div className="relative h-80 overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent sm:h-96">
            <AiFaceVisual
              state={effectiveState}
              amplitudeRef={audio.amplitudeRef}
              mouthShapeRef={audio.mouthShapeRef}
              isSpeaking={audio.isSpeaking}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center">
              <span className="flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-black/40 px-3 py-1 text-xs text-[var(--color-ink-muted)] backdrop-blur">
                <Sparkles className="h-3 w-3 text-[var(--color-accent)]" strokeWidth={1.75} />
                {STATE_LABEL[effectiveState]}
              </span>
            </div>
          </div>

          <AgentOrchestration state={effectiveState} lastAction={lastAction} />
        </div>

        {/* RIGHT — Live Activity + conversation (order-2 on mobile) */}
        <div className="order-2 flex flex-col gap-5 lg:order-3">
          <LiveActivity overview={overview} />

          <div className="flex flex-col rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02]">
            <p className="border-b border-white/[0.08] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)]">
              Conversation
            </p>
            <div className="max-h-72 flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
              {log.map((entry) => (
                <LogBubble key={entry.id} entry={entry} />
              ))}
              {speech.isListening && speech.interimTranscript ? (
                <LogBubble entry={{ id: 'interim', role: 'user', text: speech.interimTranscript }} muted />
              ) : null}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM — Voice control bar */}
      <div className="order-4 mt-5 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-4">
        {speech.error ? (
          <p className="mb-2 flex items-center gap-2 text-xs text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            {speech.error}
          </p>
        ) : null}
        {voiceUnavailableNotice ? <p className="mb-2 text-xs text-[var(--color-ink-faint)]">{voiceUnavailableNotice}</p> : null}
        {networkError ? (
          <p className="mb-2 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {networkError}
          </p>
        ) : null}

        <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
          {speech.isSupported ? (
            <button
              type="button"
              onClick={handleMicClick}
              aria-label={speech.isListening ? 'Stop listening' : 'Talk to your AI team'}
              aria-pressed={speech.isListening}
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all',
                speech.isListening
                  ? 'bg-[var(--color-accent-strong)] text-zinc-950 shadow-[0_0_30px_-4px_rgba(16,185,129,0.7)]'
                  : 'border border-white/[0.1] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-ink)]',
              )}
            >
              {speech.isListening ? <MicOff className="h-5 w-5" strokeWidth={2} /> : <Mic className="h-5 w-5" strokeWidth={2} />}
            </button>
          ) : null}

          <div className="hidden shrink-0 sm:block">
            <p className="text-sm font-medium text-[var(--color-ink)]">Talk to your AI team</p>
            <p className="text-xs text-[var(--color-ink-faint)]">
              {speech.isListening ? 'Listening…' : 'Use voice or type to communicate'}
            </p>
          </div>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask your AI assistant…"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus-visible:border-[var(--color-accent)]"
          />

          <button
            type="submit"
            disabled={!inputValue.trim()}
            aria-label="Send"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-strong)] text-zinc-950 transition-colors hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  )
}

function LogBubble({ entry, muted }: { entry: LogEntry; muted?: boolean }) {
  const isUser = entry.role === 'user'
  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[90%] rounded-[var(--radius-field)] px-3.5 py-2.5 text-sm leading-relaxed',
          muted && 'opacity-50',
          isUser
            ? 'bg-[var(--color-accent-strong)] text-zinc-950'
            : entry.role === 'system'
              ? 'bg-red-400/10 text-red-400'
              : 'bg-white/[0.05] text-[var(--color-ink-muted)]',
        )}
      >
        {entry.text}
      </div>
      {entry.actions?.map((action, i) => (
        <div
          key={i}
          className="max-w-[90%] rounded-[var(--radius-field)] border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-3.5 py-2 text-xs text-[var(--color-accent-soft)]"
        >
          <span className="font-mono">{action.action}</span> (preview only) — {action.description}
        </div>
      ))}
    </div>
  )
}

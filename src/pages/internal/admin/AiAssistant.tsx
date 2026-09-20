import { AlertCircle, Mic, MicOff, Send } from 'lucide-react'
import { useRef, useState } from 'react'
import { AgentNodeGraph } from '@/components/internal/aiAssistant/AgentNodeGraph'
import { AiFaceVisual } from '@/components/internal/aiAssistant/AiFaceVisual'
import type { AssistantState } from '@/components/internal/aiAssistant/AiFaceScene'
import { useAudioAnalyser } from '@/components/internal/aiAssistant/useAudioAnalyser'
import { useSpeechRecognition } from '@/components/internal/aiAssistant/useSpeechRecognition'
import { apiPost, ApiNetworkError } from '@/lib/api'
import { cn } from '@/lib/utils'

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

interface CommandResponseData {
  actions: SimulatedAction[]
}

interface SpeakResponseData {
  audioBase64: string
  mimeType: string
}

const GREETING: LogEntry = {
  id: 'greeting',
  role: 'assistant',
  text: "Hi — I'm Velnora's internal AI Assistant. Ask me about lead status, or tell me what you'd like the Lead Finder Agent to do and I'll preview the action here.",
}

/**
 * Admin-only voice/text console. Every action shown here is a PREVIEW —
 * see backend/src/aiAssistant/tools/simulateAgentAction.tool.ts — this
 * page never triggers a real Google Places search, website analysis, or
 * Gmail draft. That's a deliberate scope decision (voice-transcribed,
 * freeform commands shouldn't directly spend API quota or touch Gmail
 * without a human reviewing the real action from the Lead Finder pages
 * first), not a placeholder to remove later.
 */
export function AiAssistant() {
  const [log, setLog] = useState<LogEntry[]>([GREETING])
  const [assistantState, setAssistantState] = useState<AssistantState>('idle')
  const [inputValue, setInputValue] = useState('')
  const [voiceUnavailableNotice, setVoiceUnavailableNotice] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)

  const speech = useSpeechRecognition()
  const audio = useAudioAnalyser()
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  const effectiveState: AssistantState = audio.isSpeaking ? 'speaking' : assistantState

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    setNetworkError(null)
    setLog((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    setAssistantState('thinking')

    try {
      const result = await apiPost<CommandResponseData>('/admin/ai-assistant/command', {
        message: trimmed,
        history: historyRef.current,
      })

      if (!result.success) {
        setLog((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', text: result.message }])
        setAssistantState('idle')
        return
      }

      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, content: trimmed },
        { role: 'assistant' as const, content: result.message },
      ].slice(-20)

      setLog((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: result.message, actions: result.data?.actions },
      ])

      await speakReply(result.message)
    } catch (error) {
      setNetworkError(error instanceof ApiNetworkError ? error.message : 'Something went wrong. Please try again.')
      setAssistantState('idle')
    }
  }

  async function speakReply(text: string) {
    try {
      const result = await apiPost<SpeakResponseData>('/admin/ai-assistant/speak', { text })
      if (!result.success || !result.data) {
        // Voice output not configured is an expected, non-error state
        // (see backend/src/aiAssistant/elevenLabs.service.ts) — the text
        // reply above already stands on its own, so this stays a quiet
        // one-line notice, not an error banner.
        setVoiceUnavailableNotice(result.message)
        setAssistantState('idle')
        return
      }
      setVoiceUnavailableNotice(null)
      audio.playBase64Audio(result.data.audioBase64, result.data.mimeType)
      setAssistantState('idle')
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
      setAssistantState('idle')
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
      <h1 className="text-xl font-semibold">AI Assistant</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Talk or type to Velnora's internal assistant. It previews Lead Finder Agent actions here —
        it never executes them; run the real thing from the Lead Finder pages.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-6">
          <div className="h-72 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] sm:h-80">
            <AiFaceVisual state={effectiveState} amplitude={audio.amplitude} />
          </div>

          <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-4">
            <AgentNodeGraph />
          </div>
        </div>

        <div className="flex flex-col rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02]">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '28rem' }} role="log" aria-live="polite">
            {log.map((entry) => (
              <LogBubble key={entry.id} entry={entry} />
            ))}
            {speech.isListening && speech.interimTranscript ? (
              <LogBubble entry={{ id: 'interim', role: 'user', text: speech.interimTranscript }} muted />
            ) : null}
          </div>

          {voiceUnavailableNotice ? (
            <p className="border-t border-white/[0.08] px-4 py-2 text-xs text-[var(--color-ink-faint)]">
              {voiceUnavailableNotice}
            </p>
          ) : null}

          {networkError ? (
            <div className="flex items-center gap-2 border-t border-white/[0.08] px-4 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {networkError}
            </div>
          ) : null}

          <form onSubmit={handleTextSubmit} className="flex items-center gap-2 border-t border-white/[0.08] p-3">
            {speech.isSupported ? (
              <button
                type="button"
                onClick={handleMicClick}
                aria-label={speech.isListening ? 'Stop listening' : 'Start voice command'}
                aria-pressed={speech.isListening}
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
                  speech.isListening
                    ? 'bg-[var(--color-accent-strong)] text-zinc-950'
                    : 'border border-white/[0.1] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                )}
              >
                {speech.isListening ? <MicOff className="h-4 w-4" strokeWidth={2} /> : <Mic className="h-4 w-4" strokeWidth={2} />}
              </button>
            ) : null}

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={speech.isSupported ? 'Type or use the mic…' : 'Type a command…'}
              maxLength={2000}
              className="min-w-0 flex-1 rounded-[var(--radius-field)] border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus-visible:border-[var(--color-accent)]"
            />

            <button
              type="submit"
              disabled={!inputValue.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-strong)] text-zinc-950 transition-colors hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
        </div>
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
          'max-w-[85%] rounded-[var(--radius-field)] px-3.5 py-2.5 text-sm leading-relaxed',
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
          className="max-w-[85%] rounded-[var(--radius-field)] border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-3.5 py-2 text-xs text-[var(--color-accent-soft)]"
        >
          <span className="font-mono">{action.action}</span> (preview only) — {action.description}
        </div>
      ))}
    </div>
  )
}

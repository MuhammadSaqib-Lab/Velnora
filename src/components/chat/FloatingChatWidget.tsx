import { MessageCircle, Send, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { BrandMark } from '@/components/layout/BrandMark'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiPost, ApiNetworkError } from '@/lib/api'
import { MAX_LENGTHS } from '@/lib/validation'
import { cn } from '@/lib/utils'

const GREETING = "Hi there! Looking to build or rebuild your site?"
const OPENING_MESSAGE =
  "Hi, I'm Velnora's AI consultant. What are you looking to build or improve?"
const SESSION_STORAGE_KEY = 'velnora_ai_session_id'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Wrapped in try/catch: sessionStorage can throw in a private window or
 * when the browser blocks site data — the widget must still work, it
 * just won't remember the session across a page reload in that case. */
function readStoredSessionId(): string | undefined {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function storeSessionId(sessionId: string) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
  } catch {
    // Best-effort only, see readStoredSessionId.
  }
}

/**
 * Velnora's AI Consultant. Talks to the backend's POST /api/ai/chat
 * (see backend/src/services/aiChat.service.ts) — every reply shown here,
 * including error and rate-limit copy, comes verbatim from the backend,
 * this component never invents its own AI response text.
 */
export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: OPENING_MESSAGE }])
  const [sessionId, setSessionId] = useState<string | undefined>(readStoredSessionId)
  const [isSending, setIsSending] = useState(false)
  const reduce = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = document.getElementById('home')
    if (!hero) return

    // Wait until the hero has scrolled mostly out of view before popping the
    // greeting, otherwise it can overlap the hero CTAs on shorter viewports.
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          timer = setTimeout(() => setShowGreeting(true), 600)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(hero)

    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight })
  }, [messages, isSending])

  function openPanel() {
    setShowGreeting(false)
    setIsOpen(true)
  }

  function closePanel() {
    setIsOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') closePanel()
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = input.trim()
    if (!text || isSending) return

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setIsSending(true)

    try {
      const result = await apiPost<{ sessionId: string; leadCaptured: boolean }>('/ai/chat', {
        sessionId,
        message: text,
      })

      // Every branch below (success or not) carries a safe, ready-to-show
      // message from the backend — validation errors, rate limiting, and
      // provider failures all arrive as friendly text, never raw detail.
      setMessages((prev) => [...prev, { role: 'assistant', content: result.message }])
      if (result.success && result.data?.sessionId) {
        setSessionId(result.data.sessionId)
        storeSessionId(result.data.sessionId)
      }
    } catch (error) {
      const message =
        error instanceof ApiNetworkError
          ? error.message
          : 'Something went wrong on our end. Please try again shortly.'
      setMessages((prev) => [...prev, { role: 'assistant', content: message }])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            role="dialog"
            aria-label="Chat with Velnora's AI Consultant"
            onKeyDown={handleKeyDown}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex max-h-[min(85vh,600px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-[var(--color-surface)]/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <BrandMark />
                <div className="leading-tight">
                  <p className="text-sm font-medium text-[var(--color-ink)]">Velnora</p>
                  <p className="text-xs text-[var(--color-ink-faint)]">AI Consultant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close chat"
                className="text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div
              ref={transcriptRef}
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="flex min-h-[160px] flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] rounded-[var(--radius-field)] px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'self-end bg-[var(--color-accent-strong)] text-zinc-950'
                      : 'self-start bg-white/[0.05] text-[var(--color-ink-muted)]',
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {isSending ? (
                <p className="self-start text-xs text-[var(--color-ink-faint)]" aria-hidden="true">
                  Velnora AI is typing…
                </p>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-white/[0.08] px-5 py-4">
              <form onSubmit={handleSend} className="flex gap-2">
                <label htmlFor="ai-chat-input" className="sr-only">
                  Message Velnora's AI Consultant
                </label>
                <input
                  ref={inputRef}
                  id="ai-chat-input"
                  type="text"
                  maxLength={MAX_LENGTHS.chatMessage}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isSending}
                  placeholder="Type your message…"
                  className={fieldInputClass}
                />
                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  aria-label="Send message"
                  className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[var(--radius-field)] bg-[var(--color-accent-strong)] text-zinc-950 transition-colors hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" strokeWidth={2} />
                </button>
              </form>
              <p className="mt-2.5 text-center text-xs text-[var(--color-ink-faint)]">
                Prefer a form?{' '}
                <a
                  href="#contact"
                  onClick={closePanel}
                  className="underline decoration-white/30 underline-offset-2 hover:text-[var(--color-ink)]"
                >
                  Jump to Contact
                </a>
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showGreeting && !isOpen ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex max-w-[240px] items-start gap-2 rounded-[var(--radius-panel)] border border-white/[0.08] bg-[var(--color-surface)]/95 px-4 py-3 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={openPanel}
              className="text-left text-sm leading-relaxed text-[var(--color-ink)]"
            >
              {GREETING}
            </button>
            <button
              type="button"
              onClick={() => setShowGreeting(false)}
              aria-label="Dismiss"
              className="shrink-0 text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink)]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => (isOpen ? closePanel() : openPanel())}
        aria-label={isOpen ? 'Close chat' : 'Open chat with Velnora AI Consultant'}
        aria-expanded={isOpen}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-strong)] text-zinc-950 shadow-[0_0_30px_-6px_rgba(16,185,129,0.65)] transition-transform duration-200 hover:bg-[var(--color-accent)] active:scale-[0.96]"
      >
        {isOpen ? (
          <X className="h-5 w-5" strokeWidth={2} />
        ) : (
          <MessageCircle className="h-5 w-5" strokeWidth={2} />
        )}
      </button>
    </div>
  )
}

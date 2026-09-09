import { MessageCircle, Send, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { BrandMark } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'

const GREETING = "Hi there! Looking to build or rebuild your site?"

/**
 * Frontend-only quick-inquiry widget. It deliberately doesn't simulate an
 * AI conversation, that's Future Agent 1 (client-handling agent) from the
 * project brief, not built in this phase. Quick actions route to real
 * sections; the message box hands off to the real Contact form instead
 * of pretending to reply.
 */
export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [message, setMessage] = useState('')
  const [handedOff, setHandedOff] = useState(false)
  const reduce = useReducedMotion()

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

  function openPanel() {
    setShowGreeting(false)
    setIsOpen(true)
  }

  function closePanel() {
    setIsOpen(false)
    setHandedOff(false)
    setMessage('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') closePanel()
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) return
    setHandedOff(true)
    setTimeout(() => {
      closePanel()
      window.location.hash = 'contact'
    }, 1400)
  }

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            role="dialog"
            aria-label="Chat with Velnora"
            onKeyDown={handleKeyDown}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-[min(90vw,340px)] overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-[var(--color-surface)]/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <BrandMark />
                <span className="text-sm font-medium text-[var(--color-ink)]">Velnora</span>
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

            <div className="px-5 py-4">
              <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">{GREETING}</p>

              <div className="mt-4 flex flex-col gap-2">
                <Button
                  href="#contact"
                  size="md"
                  className="w-full justify-center"
                  onClick={closePanel}
                >
                  Start a Project
                </Button>
                <Button
                  href="#faq"
                  variant="secondary"
                  size="md"
                  className="w-full justify-center"
                  onClick={closePanel}
                >
                  Browse FAQ
                </Button>
              </div>

              <div className="mt-4 border-t border-white/[0.08] pt-4">
                {handedOff ? (
                  <p className="text-sm leading-relaxed text-[var(--color-accent-soft)]">
                    Thanks, we'll follow up by email. Taking you to the full contact form...
                  </p>
                ) : (
                  <form onSubmit={handleSend} className="flex flex-col gap-2">
                    <label
                      htmlFor="chat-quick-message"
                      className="text-xs text-[var(--color-ink-faint)]"
                    >
                      Or send a quick message
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="chat-quick-message"
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What are you looking to build?"
                        className={fieldInputClass}
                      />
                      <button
                        type="submit"
                        aria-label="Send message"
                        className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[var(--radius-field)] bg-[var(--color-accent-strong)] text-zinc-950 transition-colors hover:bg-[var(--color-accent)]"
                      >
                        <Send className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </form>
                )}
              </div>
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
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
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

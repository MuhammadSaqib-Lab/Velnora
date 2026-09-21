import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Minimal, browser-native speech-to-text via the Web Speech API
 * (SpeechRecognition / webkitSpeechRecognition) — no audio ever leaves
 * the browser for transcription, only the resulting text is sent to the
 * backend. Not supported in every browser (notably Firefox), so callers
 * must check `isSupported` and show a text-input fallback rather than
 * assuming the mic button always works.
 */

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow it in your browser settings, or type instead.',
  'service-not-allowed': 'Microphone access was denied. Allow it in your browser settings, or type instead.',
  'no-speech': "Didn't catch that — try again or type your message.",
  'audio-capture': 'No microphone found. You can still type your message.',
}

export function useSpeechRecognition() {
  const [isSupported] = useState(() => !!getSpeechRecognitionCtor())
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef<(text: string) => void>(() => {})

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const start = useCallback((onFinal: (text: string) => void) => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    setError(null)
    onFinalRef.current = onFinal
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) {
          onFinalRef.current(result[0].transcript.trim())
        } else {
          interim += result[0].transcript
        }
      }
      setInterimTranscript(interim)
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      setInterimTranscript('')
      setError(ERROR_MESSAGES[event.error] ?? null)
    }
    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { isSupported, isListening, interimTranscript, error, start, stop }
}

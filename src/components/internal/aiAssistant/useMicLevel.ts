import { useEffect, useRef } from 'react'

/**
 * Live microphone input level (0-1), sampled via a separate Web Audio
 * AnalyserNode while `active` is true — independent of the Web Speech
 * API used for transcription (SpeechRecognition exposes no raw audio
 * level of its own). Best-effort: if getUserMedia fails or is denied,
 * this silently stays at 0 rather than throwing, since the mic
 * permission error is already surfaced by useSpeechRecognition's own
 * error state — this hook only drives the waveform visual.
 */
export function useMicLevel(active: boolean) {
  const levelRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      levelRef.current = 0
      return
    }

    let cancelled = false

    void navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))

        const sample = () => {
          analyser.getByteTimeDomainData(data)
          let sumSquares = 0
          for (const value of data) {
            const normalized = (value - 128) / 128
            sumSquares += normalized * normalized
          }
          levelRef.current = Math.min(1, Math.sqrt(sumSquares / data.length) * 5)
          rafRef.current = requestAnimationFrame(sample)
        }
        rafRef.current = requestAnimationFrame(sample)
      })
      .catch(() => {
        levelRef.current = 0
      })

    return () => {
      cancelled = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      void audioContextRef.current?.close()
      levelRef.current = 0
    }
  }, [active])

  return levelRef
}

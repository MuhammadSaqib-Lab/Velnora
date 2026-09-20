import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Plays a base64-encoded audio reply and exposes a live 0-1 amplitude
 * value via Web Audio API's AnalyserNode, sampled every animation frame.
 * This drives the 3D face's mouth openness — it's real audio-reactive
 * animation, not per-phoneme lipsync (see AiFaceScene.tsx's comment for
 * why true viseme-accurate lipsync isn't feasible on a procedural face).
 */
export function useAudioAnalyser() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [amplitude, setAmplitude] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  const stopSampling = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setAmplitude(0)
  }, [])

  useEffect(() => {
    return () => {
      stopSampling()
      audioElRef.current?.pause()
      void audioContextRef.current?.close()
    }
  }, [stopSampling])

  const playBase64Audio = useCallback(
    (audioBase64: string, mimeType: string) => {
      try {
        const binary = atob(audioBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: mimeType })
        const url = URL.createObjectURL(blob)

        const audioEl = new Audio(url)
        audioElRef.current = audioEl

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext()
        }
        const audioContext = audioContextRef.current
        const source = audioContext.createMediaElementSource(audioEl)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyser.connect(audioContext.destination)
        analyserRef.current = analyser
        dataArrayRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))

        const sample = () => {
          const analyserNode = analyserRef.current
          const dataArray = dataArrayRef.current
          if (!analyserNode || !dataArray) return
          analyserNode.getByteTimeDomainData(dataArray)
          // RMS deviation from the 128 (silence) midpoint, normalized to ~0-1.
          let sumSquares = 0
          for (const value of dataArray) {
            const normalized = (value - 128) / 128
            sumSquares += normalized * normalized
          }
          const rms = Math.sqrt(sumSquares / dataArray.length)
          setAmplitude(Math.min(1, rms * 4))
          rafRef.current = requestAnimationFrame(sample)
        }

        audioEl.onplay = () => {
          setIsSpeaking(true)
          void audioContext.resume()
          rafRef.current = requestAnimationFrame(sample)
        }
        audioEl.onended = () => {
          setIsSpeaking(false)
          stopSampling()
          URL.revokeObjectURL(url)
        }
        audioEl.onerror = () => {
          setIsSpeaking(false)
          stopSampling()
          URL.revokeObjectURL(url)
        }

        void audioEl.play()
      } catch {
        setIsSpeaking(false)
        stopSampling()
      }
    },
    [stopSampling],
  )

  return { isSpeaking, amplitude, playBase64Audio }
}

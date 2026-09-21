import { useCallback, useEffect, useRef, useState } from 'react'

export interface MouthShape {
  /** 0-1 overall openness (low+mid frequency energy). */
  openness: number
  /** 0-1 width bias from high-frequency energy (sibilants read narrower/wider). */
  width: number
}

export interface AudioAnalyserHandle {
  isSpeaking: boolean
  /** Live values updated every animation frame via refs, NOT React state —
   * a 3D scene's useFrame loop already runs outside React's render cycle
   * (R3F drives it directly from the WebGL render loop), so surfacing
   * this as setState here would force a full React re-render 60 times a
   * second for no reason. Read `.current` directly inside useFrame. */
  amplitudeRef: React.RefObject<number>
  mouthShapeRef: React.RefObject<MouthShape>
  playBase64Audio: (audioBase64: string, mimeType: string) => void
}

/**
 * Plays a base64-encoded audio reply and exposes live, ref-based
 * amplitude + a coarse frequency-band "mouth shape" via Web Audio API's
 * AnalyserNode. This is real audio-reactive animation — genuinely
 * derived from the actual reply audio's frequency content — not
 * per-phoneme viseme lipsync. True visemes need phoneme timing (from a
 * speech model or the TTS provider's own alignment data, which
 * ElevenLabs' basic REST call here doesn't request); low/mid energy
 * driving mouth openness and high-frequency energy biasing mouth width
 * is a reasonable, honestly-scoped approximation of the same idea.
 */
export function useAudioAnalyser(): AudioAnalyserHandle {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const amplitudeRef = useRef(0)
  const mouthShapeRef = useRef<MouthShape>({ openness: 0, width: 0 })

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  const stopSampling = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    amplitudeRef.current = 0
    mouthShapeRef.current = { openness: 0, width: 0 }
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
        analyser.smoothingTimeConstant = 0.6
        source.connect(analyser)
        analyser.connect(audioContext.destination)
        analyserRef.current = analyser
        timeDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
        freqDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))

        const sample = () => {
          const analyserNode = analyserRef.current
          const timeData = timeDataRef.current
          const freqData = freqDataRef.current
          if (!analyserNode || !timeData || !freqData) return

          analyserNode.getByteTimeDomainData(timeData)
          let sumSquares = 0
          for (const value of timeData) {
            const normalized = (value - 128) / 128
            sumSquares += normalized * normalized
          }
          const rms = Math.sqrt(sumSquares / timeData.length)
          amplitudeRef.current = Math.min(1, rms * 4)

          analyserNode.getByteFrequencyData(freqData)
          const bandCount = freqData.length
          const lowEnd = Math.floor(bandCount * 0.15)
          const midEnd = Math.floor(bandCount * 0.5)
          let low = 0
          let mid = 0
          let high = 0
          for (let i = 0; i < bandCount; i += 1) {
            if (i < lowEnd) low += freqData[i]
            else if (i < midEnd) mid += freqData[i]
            else high += freqData[i]
          }
          low /= lowEnd || 1
          mid /= midEnd - lowEnd || 1
          high /= bandCount - midEnd || 1

          mouthShapeRef.current = {
            openness: Math.min(1, ((low + mid) / 2 / 255) * 1.8),
            width: Math.min(1, (high / 255) * 2.2),
          }

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

  return { isSpeaking, amplitudeRef, mouthShapeRef, playBase64Audio }
}

import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

export interface SpeechResult {
  /** Base64-encoded audio, kept in the normal JSON response envelope
   * rather than a raw binary stream — this codebase's ApiResponse<T>
   * shape and src/lib/api.ts's fetch wrapper both assume JSON, and a
   * short spoken reply is small enough that base64's ~33% overhead
   * doesn't matter. */
  audioBase64: string
  mimeType: string
}

/**
 * Text-to-speech only — no other ElevenLabs capability exists in this
 * file or anywhere else in the codebase. Mirrors AnthropicProvider's
 * lazy-optional-configuration pattern: ELEVENLABS_API_KEY unset means a
 * clear, typed error here instead of a crash, and every other AI
 * Assistant capability (text commands) keeps working normally.
 */
export async function synthesizeSpeech(text: string): Promise<SpeechResult> {
  if (!env.ELEVENLABS_API_KEY) {
    throw new AppError(503, 'Voice output is not configured yet — add ELEVENLABS_API_KEY to enable it.')
  }

  let response: Response
  try {
    response = await fetch(`${ELEVENLABS_TTS_URL}/${env.ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
  } catch (error) {
    throw new AppError(502, 'Could not reach the voice provider.', undefined, { cause: error })
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new AppError(502, 'The voice provider could not generate audio for that reply.', undefined, {
      cause: new Error(`ElevenLabs ${response.status}: ${detail}`),
    })
  }

  const arrayBuffer = await response.arrayBuffer()
  return {
    audioBase64: Buffer.from(arrayBuffer).toString('base64'),
    mimeType: 'audio/mpeg',
  }
}

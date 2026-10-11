export const PLATFORMS = ['LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X', 'YOUTUBE'] as const
export type Platform = (typeof PLATFORMS)[number]

export const CONTENT_TYPES = [
  'POST',
  'CAROUSEL',
  'VIDEO_SCRIPT',
  'REEL_CONCEPT',
  'YOUTUBE_OUTLINE',
  'HASHTAGS',
  'CASE_STUDY',
  'CAMPAIGN_POST',
] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

/**
 * Conservative, widely documented limits used only to WARN while editing —
 * platforms change them, and Velnora never posts anything, so a stale number
 * here can mislead a human reviewer at worst, never break a publication.
 */
export interface PlatformSpec {
  label: string
  /** Maximum caption/body length. */
  maxBody: number
  maxHashtags: number
  /** Title limit where the platform has titles (YouTube). */
  maxTitle?: number
  guidance: string
}

export const PLATFORM_SPECS: Record<Platform, PlatformSpec> = {
  LINKEDIN: { label: 'LinkedIn', maxBody: 3000, maxHashtags: 5, guidance: 'Professional, insight-led; a strong first line; 3–5 relevant hashtags at most.' },
  INSTAGRAM: { label: 'Instagram', maxBody: 2200, maxHashtags: 30, guidance: 'Visual and concise; hook in the first line; hashtags at the end.' },
  FACEBOOK: { label: 'Facebook', maxBody: 5000, maxHashtags: 5, guidance: 'Conversational and community-friendly; a clear call to action.' },
  TIKTOK: { label: 'TikTok', maxBody: 2200, maxHashtags: 6, guidance: 'Short, punchy hook in the first seconds; script-style; trend-aware but truthful.' },
  X: { label: 'X', maxBody: 280, maxHashtags: 2, guidance: 'One sharp idea in 280 characters; at most one or two hashtags.' },
  YOUTUBE: { label: 'YouTube', maxBody: 5000, maxHashtags: 15, maxTitle: 100, guidance: 'A searchable title (≤100 characters) and a structured description or outline.' },
}

/** Warnings for a draft that doesn't fit its platform. Advisory only. */
export function platformWarnings(platform: Platform, draft: { title?: string | null; body: string; hashtags: string[] }): string[] {
  const spec = PLATFORM_SPECS[platform]
  const warnings: string[] = []
  if (draft.body.length > spec.maxBody) {
    warnings.push(`${spec.label} captions are limited to about ${spec.maxBody} characters; this is ${draft.body.length}.`)
  }
  if (draft.hashtags.length > spec.maxHashtags) {
    warnings.push(`${spec.label} works best with at most ${spec.maxHashtags} hashtags; this has ${draft.hashtags.length}.`)
  }
  if (spec.maxTitle && draft.title && draft.title.length > spec.maxTitle) {
    warnings.push(`${spec.label} titles are limited to ${spec.maxTitle} characters; this is ${draft.title.length}.`)
  }
  return warnings
}

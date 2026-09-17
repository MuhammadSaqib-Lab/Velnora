import { env } from '../../config/env.js'
import type { BusinessCandidate, SearchParams, SearchProvider } from './types.js'

/**
 * Places API (New) Text Search — a real, official, permitted source
 * (Google's own business directory), not a scraper. No API key means no
 * requests are ever made; see isConfigured()/healthCheck().
 *
 * Capped at 20 results (Places API (New)'s per-request maximum for text
 * search); multi-page pagination via `nextPageToken` is a possible
 * future improvement, not implemented here to keep this phase's request
 * volume — and cost — bounded and predictable.
 */
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.primaryTypeDisplayName',
  'places.googleMapsUri',
].join(',')

interface PlacesTextSearchResponse {
  places?: Array<{
    displayName?: { text?: string }
    formattedAddress?: string
    websiteUri?: string
    nationalPhoneNumber?: string
    primaryTypeDisplayName?: { text?: string }
    googleMapsUri?: string
  }>
}

export class GooglePlacesProvider implements SearchProvider {
  private isConfigured(): boolean {
    return Boolean(env.GOOGLE_PLACES_API_KEY)
  }

  async findBusinesses({ industry, location, limit }: SearchParams): Promise<BusinessCandidate[]> {
    if (!this.isConfigured()) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    let response: Response
    try {
      response = await fetch(PLACES_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY as string,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: `${industry} in ${location}`,
          maxResultCount: Math.min(Math.max(limit, 1), 20),
        }),
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new Error(`Places API request failed with status ${response.status}`)
    }

    const data = (await response.json()) as PlacesTextSearchResponse
    const places = data.places ?? []

    return places
      .filter((place) => place.displayName?.text && place.googleMapsUri)
      .map((place) => ({
        businessName: place.displayName!.text!,
        category: place.primaryTypeDisplayName?.text,
        location: place.formattedAddress,
        website: place.websiteUri,
        phone: place.nationalPhoneNumber,
        sourceUrl: place.googleMapsUri!,
        source: 'Google Places',
      }))
  }

  async healthCheck(): Promise<boolean> {
    return this.isConfigured()
  }
}

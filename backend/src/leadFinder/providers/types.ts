/**
 * Provider-agnostic shape for business discovery, mirroring
 * backend/src/ai/providers/types.ts's pattern — the pipeline
 * (backend/src/leadFinder/discovery/) only imports from this file, never
 * a concrete search API client, so swapping providers later means
 * writing one new class here.
 */
export interface BusinessCandidate {
  businessName: string
  category?: string
  location?: string
  website?: string
  phone?: string
  /** A public reference URL for the listing itself (e.g. a Google Maps
   * place page) — not the business's own website. Required for every
   * candidate: this is the "reasonable evidence the business exists"
   * the source data must carry. */
  sourceUrl: string
  source: string
}

export interface SearchParams {
  industry: string
  location: string
  limit: number
}

export interface SearchProvider {
  findBusinesses(params: SearchParams): Promise<BusinessCandidate[]>
  healthCheck(): Promise<boolean>
}

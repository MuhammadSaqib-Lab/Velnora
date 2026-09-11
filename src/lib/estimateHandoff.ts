export interface PendingEstimate {
  projectType: string
  budget: string
  message: string
}

export const ESTIMATE_REQUEST_EVENT = 'velnora:estimate-request'

/**
 * One-way handoff from the Cost Estimator section to the Contact form.
 * They're sibling sections that are both already mounted on this
 * single-page app, so a custom event (not sessionStorage, which Contact
 * would only ever read once at its own mount, before this fires) is what
 * actually reaches Contact's listener regardless of click timing.
 */
export function requestEstimateHandoff(data: PendingEstimate) {
  window.dispatchEvent(new CustomEvent<PendingEstimate>(ESTIMATE_REQUEST_EVENT, { detail: data }))
}

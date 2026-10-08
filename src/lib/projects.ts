/**
 * Client Portal project types, labels and status logic, shared by the
 * client area (src/pages/client/) and the Admin Dashboard's project
 * pages. The option values must stay in sync with
 * backend/src/validators/project.validator.ts (the backend is the
 * authority; these only drive the UI).
 */

export const PROJECT_STATUSES = [
  'NEW_REQUEST',
  'REVIEWING',
  'APPROVED',
  'IN_PROGRESS',
  'CLIENT_REVIEW',
  'REVISION',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  NEW_REQUEST: 'Request received',
  REVIEWING: 'Under review',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  CLIENT_REVIEW: 'Ready for your review',
  REVISION: 'Revisions in progress',
  COMPLETED: 'Completed',
  ON_HOLD: 'On hold',
  CANCELLED: 'Cancelled',
}

/** One-line, client-friendly explanation of what each status means. */
export const STATUS_DESCRIPTIONS: Record<ProjectStatus, string> = {
  NEW_REQUEST: 'We have your request and will review it shortly.',
  REVIEWING: 'Our team is reviewing your requirements.',
  APPROVED: 'Your project is approved and queued to start.',
  IN_PROGRESS: 'We are actively working on your project.',
  CLIENT_REVIEW: 'A version is ready for you to look at.',
  REVISION: 'We are applying the changes you asked for.',
  COMPLETED: 'Your project is complete.',
  ON_HOLD: 'Work is paused for now.',
  CANCELLED: 'This project was cancelled.',
}

export const PROJECT_TYPES = [
  { value: 'business-website', label: 'Business website' },
  { value: 'ecommerce-website', label: 'E-commerce website' },
  { value: 'web-application', label: 'Web application' },
  { value: 'ai-website', label: 'AI website' },
  { value: 'ai-automation', label: 'AI automation' },
  { value: 'seo', label: 'SEO' },
  { value: 'digital-marketing', label: 'Digital marketing' },
  { value: 'website-redesign', label: 'Website redesign' },
  { value: 'custom', label: 'Custom project' },
  { value: 'other', label: 'Other' },
] as const

export const PROJECT_TIMELINES = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '1-2-weeks', label: '1–2 weeks' },
  { value: '1-month', label: 'About 1 month' },
  { value: '1-3-months', label: '1–3 months' },
  { value: 'flexible', label: 'Flexible' },
] as const

export function projectTypeLabel(value: string): string {
  return PROJECT_TYPES.find((type) => type.value === value)?.label ?? value
}

export function timelineLabel(value: string | null): string | null {
  if (!value) return null
  return PROJECT_TIMELINES.find((timeline) => timeline.value === value)?.label ?? value
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as ProjectStatus] ?? status
}

/**
 * The visible journey. Several statuses map onto one stage (e.g. both
 * REVIEWING and APPROVED sit in "Reviewed"). ON_HOLD / CANCELLED are not
 * stages — they interrupt the journey, so they have no index.
 */
export const STAGES: Array<{ label: string; statuses: ProjectStatus[] }> = [
  { label: 'Request received', statuses: ['NEW_REQUEST'] },
  { label: 'Project reviewed', statuses: ['REVIEWING', 'APPROVED'] },
  { label: 'Development', statuses: ['IN_PROGRESS'] },
  { label: 'Client review', statuses: ['CLIENT_REVIEW', 'REVISION'] },
  { label: 'Completed', statuses: ['COMPLETED'] },
]

export function stageIndex(status: string): number {
  return STAGES.findIndex((stage) => stage.statuses.includes(status as ProjectStatus))
}

export function isHalted(status: string): boolean {
  return status === 'ON_HOLD' || status === 'CANCELLED'
}

export interface ClientProject {
  id: string
  projectNumber: string
  projectName: string
  projectType: string
  description: string
  websiteUrl: string | null
  targetAudience: string | null
  requiredFeatures: string | null
  budgetRange: string | null
  timeline: string | null
  additionalNotes: string | null
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export interface ProjectHistoryEntry {
  id: string
  oldStatus: ProjectStatus | null
  newStatus: ProjectStatus
  message: string | null
  createdAt: string
  /** Only present in the admin API; the client API never sends it. */
  changedBy?: string | null
}

export interface AdminProject extends ClientProject {
  client: { name: string; email: string; phone: string | null; company: string | null }
  statusHistory?: ProjectHistoryEntry[]
}

export function formatDate(value: string, withTime = false): string {
  return new Date(value).toLocaleString(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
}

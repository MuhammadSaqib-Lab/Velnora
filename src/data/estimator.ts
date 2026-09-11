export interface BudgetTier {
  value: string
  label: string
  range: string
  description: string
}

/**
 * Mirrors the budget dropdown in the Contact form (src/sections/Contact.tsx)
 * so the estimator's result always maps to a real, selectable option there.
 */
export const budgetTiers: BudgetTier[] = [
  {
    value: 'under-500',
    label: 'Under $500 (quick fixes)',
    range: 'Under $500',
    description: 'Quick fixes and small tasks.',
  },
  {
    value: '500-1k',
    label: '$500 to $1,000 (landing pages)',
    range: '$500 to $1,000',
    description: 'A focused landing page.',
  },
  {
    value: '1k-2.5k',
    label: '$1,000 to $2,500 (full websites)',
    range: '$1,000 to $2,500',
    description: 'A full standard website.',
  },
  {
    value: '2.5k-plus',
    label: '$2,500+ (custom builds)',
    range: '$2,500+',
    description: 'A custom or advanced build.',
  },
]

export interface EstimatorOption<T extends string> {
  value: T
  label: string
  description: string
  modifier: number
}

export type ProjectTypeValue = 'landing' | 'full-website' | 'custom-app'

export const projectTypeOptions: EstimatorOption<ProjectTypeValue>[] = [
  {
    value: 'landing',
    label: 'Landing Page',
    description: 'A single focused page.',
    modifier: 1,
  },
  {
    value: 'full-website',
    label: 'Full Website',
    description: 'Multiple pages, a real site.',
    modifier: 2,
  },
  {
    value: 'custom-app',
    label: 'Custom Web App',
    description: 'Logins, dashboards, custom logic.',
    modifier: 3,
  },
]

export type DesignValue = 'template' | 'custom'

export const designOptions: EstimatorOption<DesignValue>[] = [
  {
    value: 'template',
    label: 'Template-based',
    description: 'A proven layout, tailored to your brand.',
    modifier: -1,
  },
  {
    value: 'custom',
    label: 'Fully custom design',
    description: 'Designed from scratch for your brand.',
    modifier: 0,
  },
]

export type SpeedValue = 'standard' | 'rush'

export const speedOptions: EstimatorOption<SpeedValue>[] = [
  {
    value: 'standard',
    label: 'Standard timeline',
    description: 'Our usual delivery schedule.',
    modifier: 0,
  },
  {
    value: 'rush',
    label: 'Rush delivery',
    description: 'Expedited schedule, priority slot.',
    modifier: 1,
  },
]

export function getBudgetTier(totalModifier: number): BudgetTier {
  const index = Math.min(Math.max(totalModifier, 0), budgetTiers.length - 1)
  return budgetTiers[index]
}

/**
 * Maps an estimator project type to the closest option in the Contact
 * form's project-type dropdown, which is coarser than the estimator's.
 */
export function toContactProjectType(projectType: ProjectTypeValue): string {
  return projectType === 'custom-app' ? 'other' : 'new-website'
}

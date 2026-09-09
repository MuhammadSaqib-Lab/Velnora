export interface Project {
  name: string
  industry: string
  services: string[]
  goal: string
  tags: string[]
  imageSeed: string
}

/**
 * Concept projects, not real client engagements.
 * Used to demonstrate design and technical range while we build our public case-study library.
 */
export const projects: Project[] = [
  {
    name: 'Aldergate Hotel Group',
    industry: 'Hospitality',
    services: ['Website Development', 'UI/UX Design', 'SEO'],
    goal: 'Concept redesign focused on turning browsing visitors into direct bookings instead of third-party platforms.',
    tags: ['React', 'Booking Flow', 'Local SEO'],
    imageSeed: 'velnora-aldergate-hotel',
  },
  {
    name: 'Fernweg Outdoor',
    industry: 'E-commerce',
    services: ['Website Development', 'Website Optimization'],
    goal: 'Concept storefront rebuilt around faster load times and a shorter path from product page to checkout.',
    tags: ['Headless Commerce', 'Core Web Vitals', 'Mobile-First'],
    imageSeed: 'velnora-fernweg-outdoor',
  },
  {
    name: 'Corrigan & Voss',
    industry: 'Professional Services',
    services: ['Website Development', 'SEO', 'UI/UX Design'],
    goal: 'Concept site built to read as credible to prospective clients researching a law firm before ever calling.',
    tags: ['Content Structure', 'Technical SEO', 'Accessibility'],
    imageSeed: 'velnora-corrigan-voss',
  },
  {
    name: 'Ledgerly',
    industry: 'B2B SaaS',
    services: ['Website Development', 'AI-Powered Solutions'],
    goal: 'Concept marketing site with an AI-assisted product tour replacing a generic feature list.',
    tags: ['Next.js', 'AI Search', 'Conversion Design'],
    imageSeed: 'velnora-ledgerly-saas',
  },
  {
    name: 'Meridian Wellness Clinic',
    industry: 'Healthcare',
    services: ['Website Development', 'Business Automation', 'SEO'],
    goal: 'Concept site pairing local SEO with automated intake forms to cut down front-desk admin work.',
    tags: ['Local SEO', 'Automation', 'Forms'],
    imageSeed: 'velnora-meridian-wellness',
  },
]

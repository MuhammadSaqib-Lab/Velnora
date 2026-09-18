export interface Project {
  name: string
  industry: string
  services: string[]
  goal: string
  tags: string[]
  /**
   * Real projects set `image` (an actual screenshot, e.g. from `public/work/`)
   * and `isConcept: false`. Concept projects set `imageSeed` (a picsum.photos
   * placeholder, never claimed as a real screenshot) and `isConcept: true`.
   * Work.tsx uses `isConcept` to decide whether to show the "Concept
   * project" label — never mislabel a real client site as one, and never
   * show a fabricated project without it, see CLAUDE.md's "no fabricated
   * client logos... invented statistics" rule.
   */
  image?: string
  imageSeed?: string
  isConcept: boolean
}

/**
 * A mix of real client work and concept projects. Concept projects are
 * not real client engagements, used to demonstrate design and technical
 * range while our public case-study library grows — each one is clearly
 * labeled as such on its card, never presented as real work.
 */
export const projects: Project[] = [
  {
    name: 'Aqsa Physiotherapy Centre',
    industry: 'Healthcare',
    services: ['Website Development', 'UI/UX Design'],
    goal: 'A professional healthcare and rehabilitation website featuring a modern layout, specialized treatment services, patient care highlights, and a fully responsive interface.',
    tags: ['Healthcare', 'Responsive', 'UI/UX Design'],
    image: '/work/aqsa-physiotherapy-centre.jpg',
    isConcept: false,
  },
  {
    name: 'Aldergate Hotel Group',
    industry: 'Hospitality',
    services: ['Website Development', 'UI/UX Design', 'SEO'],
    goal: 'Concept redesign focused on turning browsing visitors into direct bookings instead of third-party platforms.',
    tags: ['React', 'Booking Flow', 'Local SEO'],
    imageSeed: 'velnora-aldergate-hotel',
    isConcept: true,
  },
  {
    name: 'Fernweg Outdoor',
    industry: 'E-commerce',
    services: ['Website Development', 'Website Optimization'],
    goal: 'Concept storefront rebuilt around faster load times and a shorter path from product page to checkout.',
    tags: ['Headless Commerce', 'Core Web Vitals', 'Mobile-First'],
    imageSeed: 'velnora-fernweg-outdoor',
    isConcept: true,
  },
  {
    name: 'Corrigan & Voss',
    industry: 'Professional Services',
    services: ['Website Development', 'SEO', 'UI/UX Design'],
    goal: 'Concept site built to read as credible to prospective clients researching a law firm before ever calling.',
    tags: ['Content Structure', 'Technical SEO', 'Accessibility'],
    imageSeed: 'velnora-corrigan-voss',
    isConcept: true,
  },
  {
    name: 'Ledgerly',
    industry: 'B2B SaaS',
    services: ['Website Development', 'AI-Powered Solutions'],
    goal: 'Concept marketing site with an AI-assisted product tour replacing a generic feature list.',
    tags: ['Next.js', 'AI Search', 'Conversion Design'],
    imageSeed: 'velnora-ledgerly-saas',
    isConcept: true,
  },
  {
    name: 'Meridian Wellness Clinic',
    industry: 'Healthcare',
    services: ['Website Development', 'Business Automation', 'SEO'],
    goal: 'Concept site pairing local SEO with automated intake forms to cut down front-desk admin work.',
    tags: ['Local SEO', 'Automation', 'Forms'],
    imageSeed: 'velnora-meridian-wellness',
    isConcept: true,
  },
]

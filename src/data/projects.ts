export interface Project {
  name: string
  industry: string
  services: string[]
  goal: string
  tags: string[]
  /**
   * Real projects set `image` (an actual screenshot, from `public/work/`)
   * and `isConcept: false`, showing a "Client project" badge on a real
   * screenshot. Concept projects omit `image` and set `isConcept: true`
   * — Work.tsx renders a clean "Coming Soon" placeholder for these
   * instead of a photo, deliberately not a random stock/placeholder
   * image standing in for a design that doesn't exist yet. Never mix
   * the two: a real client site is never labeled a concept, and a
   * fabricated one is never shown without the label, see CLAUDE.md's
   * "no fabricated client logos... invented statistics" rule.
   */
  image?: string
  isConcept: boolean
}

/**
 * A mix of real client work and a small, deliberately curated set of
 * concept projects — kept short so the section reads as intentional
 * rather than padded out with placeholder cards. Concept projects are
 * not real client engagements, shown with a "Coming Soon" treatment
 * (see Work.tsx) rather than a design that doesn't actually exist yet.
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
    isConcept: true,
  },
  {
    name: 'Fernweg Outdoor',
    industry: 'E-commerce',
    services: ['Website Development', 'Website Optimization'],
    goal: 'Concept storefront rebuilt around faster load times and a shorter path from product page to checkout.',
    tags: ['Headless Commerce', 'Core Web Vitals', 'Mobile-First'],
    isConcept: true,
  },
  {
    name: 'Ledgerly',
    industry: 'B2B SaaS',
    services: ['Website Development', 'AI-Powered Solutions'],
    goal: 'Concept marketing site with an AI-assisted product tour replacing a generic feature list.',
    tags: ['Next.js', 'AI Search', 'Conversion Design'],
    isConcept: true,
  },
]

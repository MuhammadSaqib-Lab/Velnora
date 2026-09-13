/**
 * Static content for GET /api/services and GET /api/projects.
 *
 * Mirrors src/data/services.ts and src/data/projects.ts on the frontend.
 * The frontend intentionally continues to render this content from its
 * own bundled data at build time (best for LCP/CLS, see README "Why the
 * frontend doesn't fetch this at runtime"), these endpoints exist for
 * future consumers (a future CMS-backed admin view, another client,
 * automated content QA) rather than to replace that.
 */
export interface ServiceContent {
  slug: string
  title: string
  icon: string
  benefit: string
  description: string
}

export interface ProjectContent {
  slug: string
  name: string
  industry: string
  services: string[]
  goal: string
  tags: string[]
  imageSeed: string
}

export const services: ServiceContent[] = [
  {
    slug: 'website-development',
    title: 'Website Development',
    icon: 'Code2',
    benefit: 'A site built to convert, not just to exist.',
    description:
      'Custom-built websites on modern frameworks, structured around how your customers actually decide to buy, book, or reach out.',
  },
  {
    slug: 'ai-powered-solutions',
    title: 'AI-Powered Solutions',
    icon: 'BrainCircuit',
    benefit: 'Automate the busywork, keep the judgment calls.',
    description:
      'AI-assisted search, content, and support tooling layered into your site so routine questions and tasks stop landing in your inbox.',
  },
  {
    slug: 'seo',
    title: 'SEO',
    icon: 'TrendingUp',
    benefit: 'Findable by the customers already searching.',
    description:
      'Technical SEO, content structure, and on-page fundamentals built in from day one, not bolted on after launch.',
  },
  {
    slug: 'ui-ux-design',
    title: 'UI/UX Design',
    icon: 'PenTool',
    benefit: 'Interfaces people navigate without thinking.',
    description:
      'Interface and interaction design grounded in your actual user flows, tested against clarity before a line of code ships.',
  },
  {
    slug: 'website-optimization',
    title: 'Website Optimization',
    icon: 'Gauge',
    benefit: 'Every second of load time costs you visitors.',
    description:
      'Performance audits and fixes across images, scripts, and hosting so pages load fast on real connections, not just fast Wi-Fi.',
  },
  {
    slug: 'business-automation',
    title: 'Business Automation',
    icon: 'Workflow',
    benefit: 'Fewer manual steps between lead and customer.',
    description:
      'Workflow automation connecting your forms, inbox, and scheduling so qualified leads move forward without manual follow-up.',
  },
]

export const projects: ProjectContent[] = [
  {
    slug: 'aldergate-hotel-group',
    name: 'Aldergate Hotel Group',
    industry: 'Hospitality',
    services: ['Website Development', 'UI/UX Design', 'SEO'],
    goal: 'Concept redesign focused on turning browsing visitors into direct bookings instead of third-party platforms.',
    tags: ['React', 'Booking Flow', 'Local SEO'],
    imageSeed: 'velnora-aldergate-hotel',
  },
  {
    slug: 'fernweg-outdoor',
    name: 'Fernweg Outdoor',
    industry: 'E-commerce',
    services: ['Website Development', 'Website Optimization'],
    goal: 'Concept storefront rebuilt around faster load times and a shorter path from product page to checkout.',
    tags: ['Headless Commerce', 'Core Web Vitals', 'Mobile-First'],
    imageSeed: 'velnora-fernweg-outdoor',
  },
  {
    slug: 'corrigan-voss',
    name: 'Corrigan & Voss',
    industry: 'Professional Services',
    services: ['Website Development', 'SEO', 'UI/UX Design'],
    goal: 'Concept site built to read as credible to prospective clients researching a law firm before ever calling.',
    tags: ['Content Structure', 'Technical SEO', 'Accessibility'],
    imageSeed: 'velnora-corrigan-voss',
  },
  {
    slug: 'ledgerly',
    name: 'Ledgerly',
    industry: 'B2B SaaS',
    services: ['Website Development', 'AI-Powered Solutions'],
    goal: 'Concept marketing site with an AI-assisted product tour replacing a generic feature list.',
    tags: ['Next.js', 'AI Search', 'Conversion Design'],
    imageSeed: 'velnora-ledgerly-saas',
  },
  {
    slug: 'meridian-wellness-clinic',
    name: 'Meridian Wellness Clinic',
    industry: 'Healthcare',
    services: ['Website Development', 'Business Automation', 'SEO'],
    goal: 'Concept site pairing local SEO with automated intake forms to cut down front-desk admin work.',
    tags: ['Local SEO', 'Automation', 'Forms'],
    imageSeed: 'velnora-meridian-wellness',
  },
]

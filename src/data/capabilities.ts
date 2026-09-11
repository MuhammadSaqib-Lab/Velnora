export interface CapabilityBadge {
  name: string
  slug: string
}

/**
 * Technologies we build client projects with. Distinct from techStack.ts,
 * which describes what this specific site runs on, this is broader
 * service capability, not a claim about this page's own implementation.
 */
export const capabilities: CapabilityBadge[] = [
  { name: 'React', slug: 'react' },
  { name: 'TypeScript', slug: 'typescript' },
  { name: 'Tailwind CSS', slug: 'tailwindcss' },
  { name: 'Next.js', slug: 'nextdotjs' },
  { name: 'Framer Motion', slug: 'framer' },
  { name: 'Node.js', slug: 'nodedotjs' },
]

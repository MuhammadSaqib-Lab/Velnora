export interface TechLogo {
  name: string
  slug: string
}

/**
 * Real technologies this site is actually built on.
 * Rendered via Simple Icons (https://simpleicons.org), never fabricated client logos.
 */
export const techStack: TechLogo[] = [
  { name: 'React', slug: 'react' },
  { name: 'TypeScript', slug: 'typescript' },
  { name: 'Vite', slug: 'vite' },
  { name: 'Tailwind CSS', slug: 'tailwindcss' },
  { name: 'Three.js', slug: 'threedotjs' },
]

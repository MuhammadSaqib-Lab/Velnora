export interface ProcessStep {
  number: string
  title: string
  description: string
}

export const processSteps: ProcessStep[] = [
  {
    number: '01',
    title: 'Discover',
    description:
      'We map your business, your customers, and what your current site is failing to do for either of them.',
  },
  {
    number: '02',
    title: 'Strategy',
    description:
      'We define the pages, content, and technical approach that match how your customers actually search and decide.',
  },
  {
    number: '03',
    title: 'Design',
    description:
      'Interfaces are designed around your real user flows and tested for clarity before development starts.',
  },
  {
    number: '04',
    title: 'Develop',
    description:
      'We build on modern, maintainable code with performance, accessibility, and SEO handled from the first commit.',
  },
  {
    number: '05',
    title: 'Launch & Grow',
    description:
      'We ship, monitor real performance data, and keep refining the site as your traffic and goals change.',
  },
]

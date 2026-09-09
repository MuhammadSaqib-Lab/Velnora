import {
  BrainCircuit,
  Code2,
  Gauge,
  PenTool,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export interface Service {
  icon: LucideIcon
  title: string
  benefit: string
  description: string
}

export const services: Service[] = [
  {
    icon: Code2,
    title: 'Website Development',
    benefit: 'A site built to convert, not just to exist.',
    description:
      'Custom-built websites on modern frameworks, structured around how your customers actually decide to buy, book, or reach out.',
  },
  {
    icon: BrainCircuit,
    title: 'AI-Powered Solutions',
    benefit: 'Automate the busywork, keep the judgment calls.',
    description:
      'AI-assisted search, content, and support tooling layered into your site so routine questions and tasks stop landing in your inbox.',
  },
  {
    icon: TrendingUp,
    title: 'SEO',
    benefit: 'Findable by the customers already searching.',
    description:
      'Technical SEO, content structure, and on-page fundamentals built in from day one, not bolted on after launch.',
  },
  {
    icon: PenTool,
    title: 'UI/UX Design',
    benefit: 'Interfaces people navigate without thinking.',
    description:
      'Interface and interaction design grounded in your actual user flows, tested against clarity before a line of code ships.',
  },
  {
    icon: Gauge,
    title: 'Website Optimization',
    benefit: 'Every second of load time costs you visitors.',
    description:
      'Performance audits and fixes across images, scripts, and hosting so pages load fast on real connections, not just fast Wi-Fi.',
  },
  {
    icon: Workflow,
    title: 'Business Automation',
    benefit: 'Fewer manual steps between lead and customer.',
    description:
      'Workflow automation connecting your forms, inbox, and scheduling so qualified leads move forward without manual follow-up.',
  },
]

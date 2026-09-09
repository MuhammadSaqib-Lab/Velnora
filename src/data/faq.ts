export interface FaqItem {
  question: string
  answer: string
}

export const faqItems: FaqItem[] = [
  {
    question: 'How long does a typical project take?',
    answer:
      'A landing page usually takes two to three weeks from kickoff to launch. A full business site or e-commerce build typically runs four to eight weeks depending on scope. You get a specific estimate after the discovery call, not a generic range.',
  },
  {
    question: 'What does the handover process look like?',
    answer:
      'At launch you receive the full source code, documentation for anything custom, and a walkthrough call covering how the site is structured. If you are rebuilding an existing site, you can share your current codebase or a repository link through the contact form so we start with full context.',
  },
  {
    question: 'How does payment work?',
    answer:
      'Projects run on a milestone-based schedule: a deposit to begin, then payments tied to agreed milestones (design approval, development complete, launch). Every milestone and its cost is agreed upfront, no surprise invoices.',
  },
  {
    question: 'Do I need to create an account or log in?',
    answer:
      "No account or login is required to work with us. Everything runs through direct email and calls with your developer. If a client portal makes sense for a specific project later on, we'll bring it up, it's never a requirement to get started.",
  },
]

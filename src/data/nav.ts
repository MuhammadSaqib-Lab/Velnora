export interface NavItem {
  label: string
  href: string
}

export const navItems: NavItem[] = [
  { label: 'Home', href: '#home' },
  { label: 'Services', href: '#services' },
  { label: 'Process', href: '#process' },
  { label: 'Work', href: '#work' },
  { label: 'About', href: '#about' },
  { label: 'SEO', href: '#seo' },
  { label: 'Contact', href: '#contact' },
]

export const NAV_CTA_LABEL = 'Start a Project'

/**
 * "Start a Project" goes to the Client Portal's New Project form. A
 * logged-out visitor is sent through /login (or /signup) first and then
 * continues here automatically (see ClientShell's `?next=` redirect).
 * The Contact section's general inquiry form is unaffected.
 */
export const START_PROJECT_HREF = '/client/projects/new'
export const CLIENT_LOGIN_HREF = '/login'
export const CLIENT_LOGIN_LABEL = 'Client login'

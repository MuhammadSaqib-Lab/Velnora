export const SITE_URL = 'https://www.velnora.com'
export const SITE_NAME = 'Velnora'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

export interface PageSeoConfig {
  title: string
  description: string
  path: string
  keywords?: string[]
}

/**
 * Central place to add metadata for new pages/routes as the site grows,
 * without touching each page's markup.
 */
export const pageSeo = {
  home: {
    title: 'Velnora | AI-Powered Web Development & SEO Agency',
    description:
      'Velnora designs and builds high-performance websites, AI-powered digital solutions, and SEO strategies that turn visitors into customers.',
    path: '/',
    keywords: [
      'web development agency',
      'AI web development',
      'website development',
      'SEO services',
      'professional website design',
    ],
  },
} satisfies Record<string, PageSeoConfig>

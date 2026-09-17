export const SITE_URL = 'https://www.velnora.com'
export const SITE_NAME = 'Velnora'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

export interface PageSeoConfig {
  title: string
  description: string
  path: string
  keywords?: string[]
  /** Defaults to "index, follow" in the Seo component. Override per page
   * when needed (there is no longer a static <meta name="robots"> in
   * index.html — Helmet is the single source of truth so a page-specific
   * override, e.g. on a future thin/duplicate page, actually replaces
   * the default instead of producing two conflicting robots tags). */
  robots?: string
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

import { DeferredHomeSections } from '@/components/DeferredHomeSections'
import { Hero } from '@/sections/Hero'
import { LogoStrip } from '@/sections/LogoStrip'
import { Services } from '@/sections/Services'
import { Seo } from '@/lib/seo'
import { pageSeo } from '@/lib/seoConfig'

/**
 * The first screen and the services section render with the page; every
 * section after them (see src/sections/belowTheFold.tsx) is loaded and
 * mounted progressively by DeferredHomeSections.
 */
export function Home() {
  return (
    <>
      <Seo {...pageSeo.home} />
      <Hero />
      <LogoStrip />
      <Services />
      <DeferredHomeSections />
    </>
  )
}

import { About } from '@/sections/About'
import { Contact } from '@/sections/Contact'
import { CostEstimator } from '@/sections/CostEstimator'
import { CTASection } from '@/sections/CTASection'
import { FAQ } from '@/sections/FAQ'
import { FreeAudit } from '@/sections/FreeAudit'
import { Hero } from '@/sections/Hero'
import { LogoStrip } from '@/sections/LogoStrip'
import { Process } from '@/sections/Process'
import { SEOSection } from '@/sections/SEOSection'
import { Services } from '@/sections/Services'
import { TechCapabilities } from '@/sections/TechCapabilities'
import { WebDevelopment } from '@/sections/WebDevelopment'
import { WhyChooseUs } from '@/sections/WhyChooseUs'
import { Work } from '@/sections/Work'
import { Seo } from '@/lib/seo'
import { pageSeo } from '@/lib/seoConfig'

export function Home() {
  return (
    <>
      <Seo {...pageSeo.home} />
      <Hero />
      <LogoStrip />
      <Services />
      <TechCapabilities />
      <WebDevelopment />
      <SEOSection />
      <FreeAudit />
      <Process />
      <Work />
      <About />
      <WhyChooseUs />
      <CTASection />
      <FAQ />
      <CostEstimator />
      <Contact />
    </>
  )
}

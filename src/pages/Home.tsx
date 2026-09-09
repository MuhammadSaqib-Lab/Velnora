import { About } from '@/sections/About'
import { Contact } from '@/sections/Contact'
import { CTASection } from '@/sections/CTASection'
import { FAQ } from '@/sections/FAQ'
import { Hero } from '@/sections/Hero'
import { LogoStrip } from '@/sections/LogoStrip'
import { Process } from '@/sections/Process'
import { SEOSection } from '@/sections/SEOSection'
import { Services } from '@/sections/Services'
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
      <WebDevelopment />
      <SEOSection />
      <Process />
      <Work />
      <About />
      <WhyChooseUs />
      <CTASection />
      <FAQ />
      <Contact />
    </>
  )
}

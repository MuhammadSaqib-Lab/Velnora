import type { ComponentType } from 'react'
import { About } from '@/sections/About'
import { Contact } from '@/sections/Contact'
import { CostEstimator } from '@/sections/CostEstimator'
import { CTASection } from '@/sections/CTASection'
import { FAQ } from '@/sections/FAQ'
import { FinalCTA } from '@/sections/FinalCTA'
import { Founder } from '@/sections/Founder'
import { FreeAudit } from '@/sections/FreeAudit'
import { Process } from '@/sections/Process'
import { Reviews } from '@/sections/Reviews'
import { SEOSection } from '@/sections/SEOSection'
import { TechCapabilities } from '@/sections/TechCapabilities'
import { WebDevelopment } from '@/sections/WebDevelopment'
import { WhyChooseUs } from '@/sections/WhyChooseUs'
import { Work } from '@/sections/Work'

/**
 * Every homepage section after the first screen (hero, logo strip, services),
 * in page order. This module is imported dynamically by
 * DeferredHomeSections, so all of these land in one separate chunk instead of
 * the entry bundle.
 */
export const belowTheFoldSections: ComponentType[] = [
  TechCapabilities,
  WebDevelopment,
  SEOSection,
  FreeAudit,
  Process,
  Work,
  About,
  Founder,
  WhyChooseUs,
  Reviews,
  CTASection,
  FAQ,
  CostEstimator,
  Contact,
  FinalCTA,
]

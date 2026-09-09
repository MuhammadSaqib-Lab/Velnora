import { Accordion } from '@/components/ui/Accordion'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { faqItems } from '@/data/faq'

export function FAQ() {
  return (
    <section id="faq" className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          heading="Questions we hear before kickoff"
          subtext="Straightforward answers about timelines, handover, and payment."
          align="center"
        />

        <div className="mx-auto mt-14 max-w-2xl">
          <Accordion items={faqItems} />
        </div>
      </div>
    </section>
  )
}

'use client';

import { HelpCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ContactInfoFields, FaqRecord } from '@/lib/contact/types';
import SocialMediaCard from './SocialMediaCard';

type Props = { info: ContactInfoFields; faqs: FaqRecord[] };

export default function ContactConcierge({ info, faqs }: Props) {
  const published = faqs.filter((faq) => faq.isPublished);
  const hasSidebar = !!(info.whatsappNumber || info.facebookUrl || info.instagramUrl || info.linkedinUrl || info.xUrl);

  // Nothing to show: no FAQs and no social/WhatsApp.
  if (!published.length && !hasSidebar) return null;

  return (
    <section className="relative w-full py-16 md:py-24 bg-background border-b border-border/40 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-125 bg-primary/5 blur-[180px] rounded-full pointer-events-none -z-10" />

      <div className="container max-w-7xl px-4 md:px-6 mx-auto">
        {published.length > 0 && (
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12 md:mb-16">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground text-balance">{info.faqTitle}</h2>
            <p className="text-muted-foreground text-base sm:text-lg">{info.faqDescription}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {published.length > 0 && (
            <div className={hasSidebar ? 'lg:col-span-7' : 'lg:col-span-8 lg:col-start-3'}>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
                <HelpCircle className="h-5 w-5 text-primary" />
                <span>Quick answers</span>
              </h3>

              <Accordion className="space-y-3">
                {published.map((faq) => (
                  <AccordionItem
                    key={faq.id}
                    value={faq.id}
                    className="border border-border/60 rounded-2xl bg-card/30 backdrop-blur-md px-5 data-[state=open]:border-primary/50 data-[state=open]:bg-card/70 transition-all"
                  >
                    <AccordionTrigger className="font-bold text-base text-foreground hover:no-underline py-5">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed pt-1 pb-5 border-t border-border/40 mt-1 whitespace-pre-line">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {hasSidebar && (
            <div className={published.length > 0 ? 'lg:col-span-5' : 'lg:col-span-6 lg:col-start-4'}>
              <SocialMediaCard info={info} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

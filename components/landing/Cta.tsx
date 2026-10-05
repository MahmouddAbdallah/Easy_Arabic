import Image from 'next/image';
import { ArrowRight, Mail, LogIn } from 'lucide-react';
import LinkButton from './shared/LinkButton';
import Section from './shared/Section';

export default function CTA() {
    return (
        <Section aria-labelledby="cta-heading" divider={false}>
            <div className="relative isolate rounded-[32px] overflow-hidden bg-brand-deep">
                <div aria-hidden="true" className="absolute inset-0 pattern-khatam text-white opacity-[0.05] pointer-events-none" style={{ ['--pattern-size' as string]: '48px' }} />

                <div className="relative grid grid-cols-1 lg:grid-cols-12 items-center">
                    {/* Image column — sits above the copy on phones, beside it on desktop */}
                    <div className="lg:col-span-5 relative h-56 sm:h-64 lg:h-full lg:min-h-80">
                        <Image
                            src="/assets/sign-up.jpg"
                            alt="A lantern, lit for the evening"
                            fill
                            sizes="(min-width: 1024px) 40vw, 100vw"
                            className="object-cover"
                        />
                        {/* Fade into the panel along the edge that touches the copy: bottom on phones, right on desktop */}
                        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-brand-deep lg:bg-linear-to-r" />
                    </div>

                    {/* Copy column */}
                    <div className="lg:col-span-7 p-8 sm:p-12 lg:p-16 space-y-6 text-center lg:text-left">
                        <h2
                            id="cta-heading"
                            className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] text-balance"
                        >
                            Ready to get started?
                        </h2>
                        <p className="text-white/75 text-base sm:text-lg max-w-lg mx-auto lg:mx-0 leading-relaxed">
                            Reach out and tell us about your family. We&apos;ll take it from there.
                        </p>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-2">
                            <LinkButton href="/contact" tone="gold">
                                <Mail className="h-4 w-4" aria-hidden="true" />
                                <span>Contact Us</span>
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </LinkButton>
                            <LinkButton href="/sign-in" tone="onDark">
                                <LogIn className="h-4 w-4" aria-hidden="true" />
                                <span>Sign In</span>
                            </LinkButton>
                        </div>
                    </div>
                </div>
            </div>
        </Section>
    );
}

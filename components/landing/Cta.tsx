import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Mail, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CTA() {
    return (
        <section className="relative w-full py-20 md:py-28 bg-background">
            <div className="container max-w-7xl mx-auto px-4 md:px-6">
                <div className="relative rounded-[32px] overflow-hidden bg-brand-deep">
                    <div className="absolute inset-0 pattern-khatam text-white opacity-[0.05] pointer-events-none" style={{ ['--pattern-size' as string]: '48px' }} />

                    <div className="relative grid grid-cols-1 lg:grid-cols-12 items-center">
                        {/* Image column */}
                        <div className="lg:col-span-5 relative h-56 lg:h-full min-h-70">
                            <Image
                                src="/assets/sign-up.jpg"
                                alt="A lantern, lit for the evening"
                                fill
                                sizes="(min-width: 1024px) 40vw, 100vw"
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-linear-to-r from-transparent via-transparent to-[#053f3d] lg:bg-linear-to-r lg:from-transparent lg:to-brand-deep" />
                        </div>

                        {/* Copy column */}
                        <div className="lg:col-span-7 p-8 sm:p-12 lg:p-16 space-y-6 text-center lg:text-left">
                            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
                                Ready to get started?
                            </h2>
                            <p className="text-white/75 text-base sm:text-lg max-w-lg mx-auto lg:mx-0 leading-relaxed">
                                Reach out and tell us about your family. We&apos;ll take it from there.
                            </p>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-2">
                                <Link href="/contact" className="w-full sm:w-auto">
                                    <Button className="w-full sm:w-auto h-12 px-7 text-sm font-bold bg-gold text-[#2a1f04] hover:bg-gold/90 rounded-xl">
                                        <Mail className="h-4 w-4" />
                                        <span>Contact Us</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link href="/sign-in" className="w-full sm:w-auto">
                                    <Button variant="outline" className="w-full sm:w-auto h-12 px-7 text-sm font-bold rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white">
                                        <LogIn className="h-4 w-4" />
                                        <span>Sign In</span>
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

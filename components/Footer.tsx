import Link from 'next/link';
import { Mail, ArrowRight } from 'lucide-react';
import { LogoIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

const platformLinks = [
    { name: 'Home', href: '/' },
    { name: 'Contact Us', href: '/contact' },
    { name: 'Sign In', href: '/sign-in' },
];

export default function Footer() {
    return (
        <footer className="relative w-full bg-card border-t border-border/60 overflow-hidden">
            <div className="container max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-16">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">

                    {/* Brand column */}
                    <div className="md:col-span-5 space-y-4">
                        <Link href="/" className="inline-flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-brand-soft border border-brand/20">
                                <LogoIcon className="w-6 h-6 fill-brand stroke-brand" />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-foreground">
                                Easy Arabic
                            </span>
                        </Link>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                            Personally matched Quran and Arabic tutoring for families, with
                            every lesson tracked from start to finish.
                        </p>
                    </div>

                    {/* Links column */}
                    <div className="md:col-span-3 space-y-4">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                            Platform
                        </h4>
                        <ul className="space-y-2.5">
                            {platformLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-brand transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact card */}
                    <div className="md:col-span-4">
                        <div className="p-5 rounded-2xl bg-brand-soft border border-brand/20 space-y-3">
                            <p className="text-sm font-bold text-foreground">Have a question?</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Reach out and our team will personally get back to you.
                            </p>
                            <Link href="/contact">
                                <Button size="sm" className="h-9 px-4 bg-brand text-brand-foreground hover:bg-brand/90 rounded-lg font-bold">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span>Get in Touch</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="pt-8 mt-10 border-t border-border/60 text-center">
                    <p className="text-xs text-muted-foreground">
                        © {new Date().getFullYear()} Easy Arabic. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    BookOpen,
    Send,
    Mail,
    MapPin,
    ShieldCheck,
    Award,
    CheckCircle2,
    MessageCircle,
    ArrowUpRight,
    Star,
    Sparkles,
    Lock,
    Music2,
    PlayIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Footer() {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            setSubscribed(true);
            setEmail('');
            setTimeout(() => setSubscribed(false), 5000);
        }
    };

    return (
        <footer className="relative w-full bg-card border-t border-primary/20 text-foreground overflow-hidden pt-16 pb-8">

            {/* ---------------- 1. BACKGROUND AMBIENCE & ISLAMIC PATTERNS ---------------- */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-px bg-linear-to-r from-transparent via-primary to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-96 md:h-96 bg-primary/10 blur-[70px] md:blur-[150px] rounded-full pointer-events-none -z-10" />
            <div className="absolute bottom-0 right-0 w-40 h-40 md:w-80 md:h-80 bg-accent/10 blur-[70px] md:blur-[150px] rounded-full pointer-events-none -z-10" />

            {/* Subtle Geometric Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-size-[28px_28px] pointer-events-none -z-10" />

            <div className="container max-w-7xl px-4 md:px-6 mx-auto space-y-16">

                {/* ---------------- 2. TOP NEWSLETTER & BARAKAH BOX ---------------- */}
                <div className="relative rounded-3xl border border-primary/30 bg-background/80 backdrop-blur-2xl p-8 md:p-12 shadow-2xl overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none text-primary">
                        <BookOpen className="w-80 h-80" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                        {/* Text Content */}
                        <div className="lg:col-span-7 space-y-3 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold">
                                <Sparkles className="w-3.5 h-3.5 text-accent" />
                                <span>Weekly Quranic Insights & Reflections</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-foreground">
                                Enrich Your Heart with Daily <span className="text-primary">Tajweed & Wisdom</span>
                            </h3>
                            <p className="text-muted-foreground text-sm max-w-xl mx-auto lg:mx-0">
                                Subscribe to our weekly newsletter for exclusive Tajweed tips, spiritual reflections from Al-Azhar scholars, and academy updates.
                            </p>
                        </div>

                        {/* Subscription Form */}
                        <div className="lg:col-span-5">
                            <form onSubmit={handleSubscribe} className="space-y-3">
                                <div className="flex flex-col sm:flex-row gap-2.5">
                                    <div className="relative grow">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your email address..."
                                            required
                                            className="w-full h-12 pl-10 pr-4 rounded-xl border-border bg-card/90 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        className="h-12 px-6 font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shrink-0"
                                    >
                                        <span>Subscribe</span>
                                        <Send className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                                {subscribed ? (
                                    <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5 justify-center lg:justify-start">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>JazakAllah Khair! You ve been successfully subscribed.</span>
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground text-center lg:text-left flex items-center gap-1 justify-center lg:justify-start">
                                        <Lock className="w-3 h-3 text-primary" />
                                        <span>No spam, ever. Unsubscribe anytime with one click.</span>
                                    </p>
                                )}
                            </form>
                        </div>
                    </div>
                </div>

                {/* ---------------- 3. MAIN NAVIGATION & BRANDING GRID ---------------- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pt-4">

                    {/* BRAND COLUMN (4 cols) */}
                    <div className="lg:col-span-4 space-y-6">
                        <Link href="/" className="inline-flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/30 text-primary">
                                <BookOpen className="w-7 h-7" />
                            </div>
                            <div>
                                <span className="text-xl font-black tracking-tight text-foreground block">
                                    AL-AZHAR <span className="text-primary">SANAD</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground tracking-widest font-semibold uppercase block">
                                    Global Quran Academy
                                </span>
                            </div>
                        </Link>

                        <p className="text-muted-foreground text-sm leading-relaxed pr-4">
                            The world’s premier online Quran academy connecting dedicated students with authenticated, Sanad-certified Al-Azhar scholars for 1-on-1 personalized instruction.
                        </p>

                        {/* Accreditation & Quality Badges */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    <Award className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-extrabold text-foreground">Verified Al-Azhar Sanad</p>
                                    <p className="text-[11px] text-muted-foreground">Unbroken chain back to Prophet Muhammad ﷺ</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    <Star className="w-4 h-4 fill-amber-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-extrabold text-foreground">4.98 / 5.0 Global Rating</p>
                                    <p className="text-[11px] text-muted-foreground">Over 1,200+ verified student reviews</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 2: ACADEMY PROGRAMS (2 cols) */}
                    <div className="lg:col-span-2 space-y-4">
                        <h4 className="text-sm font-extrabold text-foreground uppercase tracking-wider border-b border-border pb-2">
                            Programs
                        </h4>
                        <ul className="space-y-2.5 text-sm">
                            {[
                                { name: 'Ijazah Certification', href: '/programs/ijazah' },
                                { name: 'Tajweed Rules & Practice', href: '/programs/tajweed' },
                                { name: 'Quran Memorization (Hifz)', href: '/programs/hifz' },
                                { name: 'Qira’at Studies (10 Readings)', href: '/programs/qiraat' },
                                { name: 'Quranic Arabic Language', href: '/programs/arabic' },
                                { name: 'Islamic Studies & Tafseer', href: '/programs/tafseer' },
                                { name: 'Kids Quran & Qaida Program', href: '/programs/kids' },
                            ].map((item, idx) => (
                                <li key={idx}>
                                    <Link
                                        href={item.href}
                                        className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-between group text-xs md:text-sm font-medium"
                                    >
                                        <span>{item.name}</span>
                                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* COLUMN 3: STUDENT RESOURCES (2 cols) */}
                    <div className="lg:col-span-2 space-y-4">
                        <h4 className="text-sm font-extrabold text-foreground uppercase tracking-wider border-b border-border pb-2">
                            Resources
                        </h4>
                        <ul className="space-y-2.5 text-sm">
                            {[
                                { name: 'Student Portal Login', href: '/portal' },
                                { name: 'Book Free Evaluation', href: '/trial' },
                                { name: 'Sanad Verification Checker', href: '/verify-sanad' },
                                { name: 'Class Schedule & Timezones', href: '/schedule' },
                                { name: 'Scholar & Tutor Directory', href: '/tutors' },
                                { name: 'Quranic Blog & Tajweed Guides', href: '/blog' },
                                { name: 'Tution Fees & Pricing Plans', href: '/pricing' },
                            ].map((item, idx) => (
                                <li key={idx}>
                                    <Link
                                        href={item.href}
                                        className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-between group text-xs md:text-sm font-medium"
                                    >
                                        <span>{item.name}</span>
                                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* COLUMN 4: GLOBAL HEADQUARTERS & CONTACT (4 cols) */}
                    <div className="lg:col-span-4 space-y-5">
                        <h4 className="text-sm font-extrabold text-foreground uppercase tracking-wider border-b border-border pb-2">
                            Global Admissions & Support
                        </h4>

                        <div className="space-y-3.5 text-sm">
                            {/* Live Support Indicator */}
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                                    <span className="text-xs font-bold text-foreground">Live Admissions Online</span>
                                </div>
                                <span className="text-[11px] text-emerald-500 font-extrabold">24/7 Available</span>
                            </div>

                            {/* Contact Details */}
                            <div className="space-y-2.5 pt-1">
                                <a
                                    href="https://wa.me/201000000000"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors text-xs md:text-sm font-medium"
                                >
                                    <div className="p-2 rounded-xl bg-card border border-border text-emerald-500">
                                        <MessageCircle className="w-4 h-4" />
                                    </div>
                                    <span>WhatsApp Support: +20 (100) 000-0000</span>
                                </a>

                                <a
                                    href="mailto:admissions@alazharsanad.com"
                                    className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors text-xs md:text-sm font-medium"
                                >
                                    <div className="p-2 rounded-xl bg-card border border-border text-primary">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <span>admissions@alazharsanad.com</span>
                                </a>

                                <div className="flex items-start gap-3 text-muted-foreground text-xs md:text-sm font-medium">
                                    <div className="p-2 rounded-xl bg-card border border-border text-accent shrink-0 mt-0.5">
                                        <MapPin className="w-4 h-4" />
                                    </div>
                                    <span>
                                        Cairo HQ: Al-Azhar Complex, Nasr City, Cairo, Egypt
                                        <br />
                                        <span className="text-[11px] text-muted-foreground/70">UK Office: London, SW1A 1AA</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div className="pt-2 space-y-2">
                            <p className="text-xs font-bold text-foreground">Follow Our Recitations & Content</p>
                            <div className="flex items-center gap-2">
                                {[
                                    { label: 'YouTube', icon: PlayIcon, href: '#' },
                                    { label: 'Instagram', icon: PlayIcon, href: '#' },
                                    { label: 'Facebook', icon: PlayIcon, href: '#' },
                                    { label: 'Telegram', icon: Send, href: '#' },
                                    { label: 'Spotify', icon: Music2, href: '#' },
                                ].map((soc, idx) => {
                                    const SocIcon = soc.icon;
                                    return (
                                        <a
                                            key={idx}
                                            href={soc.href}
                                            aria-label={soc.label}
                                            className="h-9 w-9 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-all"
                                        >
                                            <SocIcon className="h-4 w-4" />
                                        </a>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                </div>

                {/* ---------------- 4. BOTTOM BAR: COPYRIGHT & LEGAL ---------------- */}
                <div className="pt-8 border-t border-border/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-medium text-center md:text-left">

                    <div className="space-y-1">
                        <p>© {new Date().getFullYear()} Al-Azhar Sanad Global Quran Academy. All Rights Reserved.</p>
                        <p className="text-[11px] text-muted-foreground/70">
                            Dedicated to preserving authentic Quranic recitation with excellence (Ihsan).
                        </p>
                    </div>

                    {/* Legal Links */}
                    <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
                        <Link href="/privacy" className="hover:text-primary transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="hover:text-primary transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="/cookies" className="hover:text-primary transition-colors">
                            Cookie Settings
                        </Link>
                        <Link href="/security" className="hover:text-primary transition-colors flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>SSL Secure</span>
                        </Link>
                    </div>

                </div>

            </div>
        </footer>
    );
}
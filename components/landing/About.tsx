'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
    Award,
    BookOpenCheck,
    Users,
    GraduationCap,
    ArrowRight,
    Sparkles,
    ShieldCheck,
    Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function About() {
    return (
        <section className="relative w-full py-24 md:py-32 overflow-hidden bg-background border-b border-border/40">

            {/* ---------------- 1. LUXURY LIGHTING & AMBIENT GLOWS ---------------- */}

            {/* Ambient Background Glows */}
            <div className="absolute top-1/2 -left-40 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-primary/10 blur-[100px] md:blur-[200px] rounded-full pointer-events-none -z-10" />
            <div className="absolute top-1/4 -right-40 w-[260px] h-[260px] md:w-[500px] md:h-[500px] bg-accent/15 blur-[90px] md:blur-[180px] rounded-full pointer-events-none -z-10 animate-[pulse_8s_ease-in-out_infinite]" />

            {/* Grid Pattern Mesh */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none -z-10" />

            {/* ---------------- 2. MAIN CONTAINER ---------------- */}
            <div className="container max-w-7xl px-4 md:px-6 mx-auto space-y-20">

                {/* HEADER SECTION */}
                <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-2xl text-primary text-xs md:text-sm font-semibold shadow-sm">
                        <Compass className="h-4 w-4 text-primary animate-[spin_10s_linear_infinite]" />
                        <span className="tracking-wide">Our Sacred Heritage & Vision</span>
                    </div>

                    <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.12]">
                        Preserving authentic Quranic roots with{' '}
                        <span className="text-primary">
                            modern mastery
                        </span>
                    </h2>

                    <p className="text-muted-foreground text-base sm:text-lg leading-relaxed font-normal">
                        Founded to bridge traditional Sanad scholarship with world-class digital learning, we provide families across the globe with a refined, direct chain of authentic Quranic transmission.
                    </p>
                </div>

                {/* CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

                    {/* LEFT COLUMN: Luxury Showcase Gallery */}
                    <div className="lg:col-span-6 relative">

                        {/* Glow halo behind visual stacked cards */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-accent/20 to-transparent blur-3xl rounded-[32px] -z-10" />

                        <div className="relative space-y-6">
                            {/* Primary Main Showcase Image */}
                            <div className="relative w-full aspect-[4/3] rounded-[24px] overflow-hidden border border-border/80 bg-card/40 backdrop-blur-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] group">
                                <div className="relative w-full h-full rounded-[18px] overflow-hidden">
                                    <Image
                                        src="/about.jpg"
                                        alt="Traditional Quranic Mastery"
                                        fill
                                        className="object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

                                    {/* Overlay Floating Tag */}
                                    <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-card/85 backdrop-blur-xl border border-border/80 shadow-lg flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-primary/20 text-primary">
                                                <Award className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-foreground">Unbroken Chains of Sanad</p>
                                                <p className="text-[11px] text-muted-foreground">Direct oral transmission back to the Prophet ﷺ</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Secondary Stat Callout Ribbon */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl bg-card/50 border border-border/60 backdrop-blur-xl shadow-sm space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-black text-foreground">100%</span>
                                        <ShieldCheck className="h-5 w-5 text-primary" />
                                    </div>
                                    <p className="text-xs font-semibold text-muted-foreground">Authentic Vetting Standard</p>
                                </div>

                                <div className="p-5 rounded-2xl bg-card/50 border border-border/60 backdrop-blur-xl shadow-sm space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-black text-foreground">1-on-1</span>
                                        <GraduationCap className="h-5 w-5 text-accent" />
                                    </div>
                                    <p className="text-xs font-semibold text-muted-foreground">Tailored Private Mentorship</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Core Values & Pillars */}
                    <div className="lg:col-span-6 space-y-8">

                        <div className="space-y-4">
                            <span className="text-xs font-bold tracking-wider text-primary uppercase">Why Families Choose Us</span>
                            <h3 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground leading-snug">
                                An uncompromising commitment to elegance, accuracy, and spiritual growth.
                            </h3>
                            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                                We believe Quranic education should combine sacred traditions with high-end digital infrastructure. Our platform gives you complete visibility into your family’s progress while holding every teacher to the highest academic standard.
                            </p>
                        </div>

                        {/* Feature Blocks */}
                        <div className="space-y-4">
                            {[
                                {
                                    icon: BookOpenCheck,
                                    title: "Rigorous Ijazah Accreditation",
                                    desc: "Every instructor possesses verifiable Sanad certificates granted by renowned Islamic universities."
                                },
                                {
                                    icon: Users,
                                    title: "Designed for Modern Families",
                                    desc: "Manage multiple children, schedule sessions across global timezones, and review progress in one dashboard."
                                },
                                {
                                    icon: Sparkles,
                                    title: "Holistic Spiritual Development",
                                    desc: "Beyond Tajweed, our curriculum incorporates proper Adab, Arabic comprehension, and spiritual mentorship."
                                }
                            ].map((pillar, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 sm:p-5 rounded-2xl bg-card/40 border border-border/60 backdrop-blur-md transition-all duration-300 hover:bg-card/80 hover:border-border hover:-translate-y-0.5 group flex gap-4 items-start"
                                >
                                    <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                        <pillar.icon className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                                            {pillar.title}
                                        </h4>
                                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                            {pillar.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Action Link */}
                        <div className="pt-2 flex items-center gap-4">
                            <Link href="/about">
                                <Button size="lg" className="h-12 px-7 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all rounded-xl">
                                    <span>Discover Our Methodology</span>
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </Link>
                        </div>

                    </div>

                </div>

                {/* ---------------- 3. TRUST & COMMITMENT FOOTER BANNER ---------------- */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-card/80 via-card/40 to-card/80 border border-border/80 backdrop-blur-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center md:text-left">
                        <h4 className="text-xl font-bold text-foreground">Ready to elevate your Quranic journey?</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
                            Join thousands of households world-wide receiving direct, authentic Quranic instruction today.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Link href="/register">
                            <Button size="lg" className="h-11 px-6 font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
                                Apply for Admission
                            </Button>
                        </Link>
                    </div>
                </div>

            </div>
        </section>
    );
}
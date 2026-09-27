'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Sparkles,
    ArrowRight,
    ShieldCheck,
    Calendar,
    Star,
    Award,
    Clock,
    BookOpen,
    PhoneCall,
    Zap,
    Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CTA() {
    // Simulated live remaining slots count for FOMO & conversion boost
    const [slotsLeft, setSlotsLeft] = useState(7);

    // Subtle slot counter animation effect
    useEffect(() => {
        const interval = setInterval(() => {
            setSlotsLeft((prev) => (prev > 3 ? prev - 1 : 7));
        }, 45000); // resets or ticks down every 45s
        return () => clearInterval(interval);
    }, []);

    return (
        <section className="relative w-full flex items-center justify-center overflow-hidden bg-background py-16 md:py-20 lg:py-10 lg:min-h-screen lg:h-screen">

            {/* ---------------- 1. AMBIENT LUXURY LIGHTING ---------------- */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[280px] md:w-[1000px] md:h-[500px] bg-gradient-to-r from-primary/20 via-accent/15 to-primary/10 blur-[90px] md:blur-[180px] rounded-full pointer-events-none -z-10 animate-[pulse_8s_ease-in-out_infinite]" />
            <div className="absolute -top-24 left-10 w-40 h-40 md:w-80 md:h-80 bg-primary/10 blur-[70px] md:blur-[140px] rounded-full pointer-events-none -z-10" />
            <div className="absolute -bottom-24 right-10 w-40 h-40 md:w-80 md:h-80 bg-accent/10 blur-[70px] md:blur-[140px] rounded-full pointer-events-none -z-10" />

            {/* Islamic Subtle Geometric Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

            {/* ---------------- 2. MAIN CONTAINER ---------------- */}
            <div className="container max-w-7xl px-4 md:px-6 mx-auto my-auto">

                {/* Big Floating Glass Box */}
                <div className="relative rounded-[28px] md:rounded-[36px] border border-primary/30 bg-card/60 backdrop-blur-3xl p-6 md:p-10 lg:p-12 shadow-[0_30px_80px_rgba(0,0,0,0.35)] overflow-hidden">

                    {/* Top Decorative Accent Bar */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent" />

                    {/* Corner Quranic Geometric Icon watermark */}
                    <div className="absolute -right-12 -bottom-12 opacity-5 pointer-events-none text-primary">
                        <BookOpen className="w-80 h-80 md:w-96 md:h-96" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

                        {/* LEFT COLUMN: Main Call to Action Copy */}
                        <div className="lg:col-span-7 space-y-4 md:space-y-6 text-center lg:text-left">

                            {/* Badge */}
                            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-bold shadow-inner">
                                <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
                                <span>Begin Your Quranic Transformation</span>
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                            </div>

                            {/* Heading */}
                            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
                                Elevate Your Recitation to{' '}
                                <span className="text-primary ">
                                    Sanad & Ijazah Standards
                                </span>
                            </h2>

                            {/* Verse Callout */}
                            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-md max-w-2xl mx-auto lg:mx-0 space-y-1">
                                <p dir="rtl" className="text-base sm:text-lg font-extrabold font-serif text-foreground text-center lg:text-right leading-relaxed">
                                    “وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا”
                                </p>
                                <p className="text-[11px] text-muted-foreground italic text-center lg:text-right">
                                    “And recite the Quran with measured, beautiful recitation.” — Surah Al-Muzzammil, Ayah 4
                                </p>
                            </div>

                            {/* Subtitle */}
                            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-normal max-w-2xl mx-auto lg:mx-0">
                                Join thousands of dedicated adult learners and families worldwide. Book a private 1-on-1 evaluation session with a Sanad-certified Al-Azhar Sheikh today.
                            </p>

                            {/* Micro Benefit List */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-left max-w-xl mx-auto lg:mx-0">
                                {[
                                    "Free 30-Min Diagnostic & Tajweed Assessment",
                                    "No Credit Card Required to Reserve",
                                    "Choice of Male or Female Ijazah Tutors",
                                    "Flexible Timings for Global Timezones"
                                ].map((benefit, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-500 shrink-0">
                                            <Check className="h-3 w-3" />
                                        </div>
                                        <span className="text-xs font-semibold text-foreground">
                                            {benefit}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                                <Link href="/register?trial=true" className="w-full sm:w-auto">
                                    <Button size="lg" className="w-full sm:w-auto h-12 md:h-14 px-7 text-sm font-extrabold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_10px_30px_rgba(0,0,0,0.3)] shadow-primary/30 rounded-2xl transition-all scale-100 hover:scale-[1.02]">
                                        <Calendar className="h-4 w-4 mr-2" />
                                        <span>Book Free Evaluation Session</span>
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                </Link>

                                <Link href="/contact" className="w-full sm:w-auto">
                                    <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 md:h-14 px-6 text-xs font-bold border-border/80 hover:bg-card/80 rounded-2xl">
                                        <PhoneCall className="h-4 w-4 mr-2 text-primary" />
                                        <span>Talk to Admissions Advisor</span>
                                    </Button>
                                </Link>
                            </div>

                            {/* Trust Guarantee Note */}
                            <div className="flex items-center justify-center lg:justify-start gap-2 text-[11px] text-muted-foreground font-medium pt-1">
                                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                <span>100% Risk-Free Guarantee — 30-Day Money Back Protection</span>
                            </div>

                        </div>

                        {/* RIGHT COLUMN: Interactive Slot Card & Social Proof */}
                        <div className="lg:col-span-5 relative flex flex-col items-center justify-center">

                            {/* Glow behind card */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-accent/20 to-emerald-500/10 blur-3xl rounded-[32px] opacity-80 -z-10" />

                            <div className="w-full max-w-md rounded-[24px] bg-background/90 border border-border/90 p-5 md:p-6 backdrop-blur-2xl shadow-2xl space-y-4 md:space-y-5">

                                {/* Card Header */}
                                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                                            <Award className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-extrabold text-foreground">Free Trial Pass</h4>
                                            <p className="text-[11px] text-muted-foreground font-medium">Verified Sanad Session</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[11px] font-black animate-pulse">
                                        $0.00 FREE
                                    </span>
                                </div>

                                {/* Live Slot Counter Indicator */}
                                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-amber-500 animate-spin" style={{ animationDuration: '10s' }} />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">Today's Evaluation Slots</p>
                                            <p className="text-[10px] text-muted-foreground">High demand for Al-Azhar scholars</p>
                                        </div>
                                    </div>
                                    <span className="text-base font-black text-amber-500">
                                        {slotsLeft} Left
                                    </span>
                                </div>

                                {/* Social Proof Ticker */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                                        <span>Active Global Learners</span>
                                        <span className="text-primary font-bold">5,240+ Students</span>
                                    </div>

                                    {/* Student Avatars Stack & Rating */}
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/50">
                                        <div className="flex -space-x-2 overflow-hidden">
                                            {[
                                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
                                                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
                                                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
                                                'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
                                            ].map((imgUrl, index) => (
                                                <img
                                                    key={index}
                                                    src={imgUrl}
                                                    alt={`Student avatar ${index + 1}`}
                                                    className="inline-block h-7 w-7 rounded-full ring-2 ring-background object-cover"
                                                />
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-1 text-amber-500 font-bold text-[11px]">
                                            <Star className="h-3.5 w-3.5 fill-amber-500" />
                                            <span>4.98 / 5.0 (1.2k+)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Instant Claim Button in Card */}
                                <Link href="/register?trial=true" className="block w-full">
                                    <Button className="w-full h-11 text-xs font-extrabold bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg rounded-xl">
                                        <Zap className="h-3.5 w-3.5 mr-2 fill-accent-foreground" />
                                        <span>Claim Your Free Slot Now</span>
                                    </Button>
                                </Link>

                                <p className="text-[10px] text-center text-muted-foreground">
                                    Instant confirmation via Email & WhatsApp
                                </p>

                            </div>

                        </div>

                    </div>

                </div>

            </div>
        </section>
    );
}

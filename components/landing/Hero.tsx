'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    Sparkles,
    ArrowRight,
    ShieldCheck,
    Play,
    Star,
    CheckCircle2,
    Lock,
    Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Hero() {
    return (
        <section className="relative w-full overflow-hidden bg-background flex items-center justify-center border-b border-border/40 py-16 md:py-20 lg:py-0 lg:h-screen lg:min-h-[780px] lg:max-h-[1080px]">

            {/* ---------------- 1. LUXURY LIGHTING & SPOTLIGHT EFFECTS ---------------- */}

            {/* Top Center Spotlight Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[280px] md:w-[1000px] md:h-[500px] bg-gradient-to-b from-primary/20 via-accent/10 to-transparent blur-[90px] md:blur-[160px] rounded-full pointer-events-none -z-10 animate-[pulse_6s_ease-in-out_infinite]" />

            {/* Ambient Side Lights */}
            <div className="absolute top-1/3 -left-32 w-[260px] h-[260px] md:w-[500px] md:h-[500px] bg-secondary/15 blur-[100px] md:blur-[180px] rounded-full pointer-events-none -z-10" />
            <div className="absolute bottom-0 -right-32 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-primary/10 blur-[100px] md:blur-[180px] rounded-full pointer-events-none -z-10" />

            {/* Modern High-End Grid lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

            {/* ---------------- 2. FULLSCREEN MAIN CONTAINER ---------------- */}
            <div className="container max-w-7xl px-4 md:px-6 h-full flex flex-col justify-between py-8 md:py-12">

                {/* Top spacer for navbar balancing */}
                <div className="h-2" />

                {/* Split Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto">

                    {/* LEFT COLUMN: Luxury Typography & Copy */}
                    <div className="lg:col-span-7 flex flex-col items-start space-y-6 lg:space-y-8">

                        {/* Live Status Badge */}
                        <div className="animate-fade-in-up">
                            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-2xl text-primary text-xs md:text-sm font-semibold shadow-[0_0_20px_-3px_rgba(0,0,0,0.2)] shadow-primary/20 transition-all hover:bg-primary/10 cursor-default">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                                </span>
                                <span className="tracking-wide">Elite Sanad-Certified Quranic Learning</span>
                                <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
                            </div>
                        </div>

                        {/* Headline */}
                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-foreground leading-[1.08] animate-fade-in-up [animation-delay:150ms]">
                            The Gold Standard in{' '}
                            <span className="text-primary">
                                Family Quranic
                            </span>{' '}
                            Education
                        </h1>

                        {/* Subtitle */}
                        <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-xl font-normal leading-relaxed animate-fade-in-up [animation-delay:300ms]">
                            Connect your entire household with verified Sanad tutors. Experience seamless live lessons, real-time memorization tracking, and tailored guidance in one modern sanctuary.
                        </p>

                        {/* Feature Pills */}
                        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-foreground font-semibold pt-1 animate-fade-in-up [animation-delay:450ms]">
                            {[
                                "Sanad & Ijazah Certified",
                                "Unified Family Portal",
                                "Live Milestone Analytics"
                            ].map((feature, index) => (
                                <div key={index} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/60 border border-border/60 backdrop-blur-md shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-card/90 hover:border-border">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full pt-2 animate-fade-in-up [animation-delay:600ms]">
                            <Link href="/register" className="w-full sm:w-auto">
                                <Button size="lg" className="w-full sm:w-auto h-12 md:h-14 px-9 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_-5px_rgba(0,0,0,0.3)] shadow-primary/40 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] rounded-xl">
                                    <span>Start Family Membership</span>
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </Link>

                            <Link href="/demo" className="w-full sm:w-auto">
                                <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 md:h-14 px-8 text-base font-semibold border-border/80 bg-card/30 backdrop-blur-xl hover:bg-accent hover:text-accent-foreground transition-all duration-300 hover:-translate-y-0.5 rounded-xl">
                                    <Play className="h-4 w-4 mr-2 fill-current text-primary" />
                                    <span>Platform Overview</span>
                                </Button>
                            </Link>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Ultra-Luxury Mockup Frame */}
                    <div className="lg:col-span-5 relative flex justify-center items-center animate-fade-in-up [animation-delay:400ms]">

                        {/* Multi-layered Neon Ambient Light behind image */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-accent/20 to-primary blur-3xl rounded-[40px] opacity-80 -z-10 animate-pulse" />

                        {/* Floating Glass Container */}
                        <div className="relative w-full max-w-md lg:max-w-none aspect-[4/3] lg:aspect-[4/5] max-h-[480px] lg:max-h-[540px] rounded-[28px] overflow-hidden border border-border/80 bg-card/40 backdrop-blur-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.4)] group animate-float">

                            {/* Inner Screen Surface */}
                            <div className="relative w-full h-full rounded-[20px] overflow-hidden bg-background border border-border/50">

                                {/* App Screen Header Chrome */}
                                <div className="absolute top-0 inset-x-0 h-10 bg-card/80 backdrop-blur-md border-b border-border/50 z-20 px-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                        <Lock className="h-3 w-3 text-primary" />
                                        <span>family.quran.app</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                                            <Radio className="h-3 w-3 animate-pulse" />
                                            Live Session
                                        </span>
                                    </div>
                                </div>

                                {/* MAIN IMAGE */}
                                <Image
                                    src="/hero.jpg"
                                    alt="Quran Platform Showcase"
                                    fill
                                    priority
                                    className="object-cover transition-transform duration-1000 ease-out group-hover:scale-105 pt-10"
                                />

                                {/* Cinematic Vignette Fade */}
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-90" />

                                {/* Floating Highlight Card */}
                                <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-card/85 backdrop-blur-xl border border-border/80 shadow-2xl z-20 flex items-center justify-between transition-all duration-300 group-hover:-translate-y-1">
                                    <div className="flex items-center gap-3.5">
                                        <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 transition-colors group-hover:bg-primary/30">
                                            <ShieldCheck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground">100% Certified Tutors</p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">Sanad Connected to the Prophet ﷺ</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl text-xs font-bold transition-transform hover:scale-110">
                                        <Star className="h-3.5 w-3.5 fill-current" />
                                        <span>4.99</span>
                                    </div>
                                </div>

                            </div>

                        </div>

                    </div>

                </div>

                {/* ---------------- 3. FOOTER IMPACT STRIP ---------------- */}
                <div className="pt-6 border-t border-border/40 grid grid-cols-2 md:grid-cols-4 gap-6 text-center animate-fade-in-up [animation-delay:750ms]">
                    {[
                        { value: "100%", label: "Sanad Verified Teachers" },
                        { value: "2,500+", label: "Active Families Enrolled" },
                        { value: "60,000+", label: "Completed Class Hours" },
                        { value: "99.4%", label: "Satisfaction Rating" }
                    ].map((stat, index) => (
                        <div key={index} className="flex flex-col items-center group cursor-default">
                            <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight transition-all duration-300 group-hover:text-primary group-hover:scale-105">{stat.value}</p>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5 transition-colors group-hover:text-foreground">{stat.label}</p>
                        </div>
                    ))}
                </div>

            </div>
            <style jsx>{`            
                    @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }

                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    }

                    @keyframes float {

                    0%,
                    100% {
                        transform: translateY(0);
                    }

                    50% {
                        transform: translateY(-10px);
                    }
                    }

                    .animate-fade-in-up {
                    animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }

                    .animate-float {
                    animation: float 5s ease-in-out infinite;
                    }

                    @media (prefers-reduced-motion: reduce) {
                    .animate-fade-in-up,
                    .animate-float {
                        animation: none;
                    }
                    }
            `}</style>
        </section>
    );
}
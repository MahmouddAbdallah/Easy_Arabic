'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    GraduationCap,
    HeartHandshake,
    BookOpenCheck,
    Building2,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    ShieldCheck,
    Award,
    Users,
    ChevronRight,
    Star,
    Lock,
    Play,
    Pause
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForRole() {
    const [activeRole, setActiveRole] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    const roles = [
        {
            id: 'students',
            roleName: 'For Students',
            roleTitleArabic: 'للطلاب والدارسين',
            badge: 'Personalized Mastery',
            icon: GraduationCap,
            tagline: 'Tailored Quranic journeys designed to fit your busy life and elevate your recitation to Ijazah standard.',
            highlights: [
                'Direct 1-on-1 sessions with verified Sanad-holding Sheikhs',
                'Flexible scheduling across all international time zones',
                'Interactive digital Mushaf with live Tajweed correction',
                'Personalized Hifz & Muraqa\'ah memory retention plans'
            ],
            statNumber: '100%',
            statLabel: '1-on-1 Dedicated Focus',
            quote: '“بل هو آيات بينات في صدور الذين أوتوا العلم”',
            surahReference: 'Surah Al-Ankabut — Ayah 49',
            ctaText: 'Start Your Learning Journey',
            ctaLink: '/register?role=student',
            previewCardTitle: 'Student Sanctuary Dashboard',
            previewBadge: 'Active Student Portal'
        },
        {
            id: 'parents',
            roleName: 'For Parents',
            roleTitleArabic: 'لأولياء الأمور والأسر',
            badge: 'Peace of Mind & Safety',
            icon: HeartHandshake,
            tagline: 'Complete visibility into your family’s spiritual growth with unified family management and vetted tutors.',
            highlights: [
                'Centralized household dashboard for multiple children',
                'Choice of highly qualified female or male scholars',
                'Real-time lesson attendance & weekly Tajweed progress reports',
                'Safe, recorded sessions for complete parental reassurance'
            ],
            statNumber: '24/7',
            statLabel: 'Parental Progress Visibility',
            quote: '“رب اجعلني مقيم الصلاة ومن ذريتي ربنا وتقبل دعاء”',
            surahReference: 'Surah Ibrahim — Ayah 40',
            ctaText: 'Enroll Your Family',
            ctaLink: '/register?role=parent',
            previewCardTitle: 'Household Command Center',
            previewBadge: 'Family Sync Active'
        },
        {
            id: 'teachers',
            roleName: 'For Scholars & Teachers',
            roleTitleArabic: 'للمعلمين والمشايخ',
            badge: 'Global Impact & Outreach',
            icon: BookOpenCheck,
            tagline: 'Empower students worldwide through an elite digital studio crafted exclusively for Sanad Quranic education.',
            highlights: [
                'Teach motivated students from over 40+ countries',
                'State-of-the-art virtual classroom with HD audio & digital pen support',
                'Automated scheduling, attendance tracking & student evaluations',
                'Prestigious platform membership reserved for verified Ijazah holders'
            ],
            statNumber: '40+',
            statLabel: 'Countries Reached',
            quote: '“خيركم من تعلم القرآن وعلمه”',
            surahReference: 'Prophetic Hadith (Sahih Al-Bukhari)',
            ctaText: 'Apply as a Sanad Tutor',
            ctaLink: '/apply-teacher',
            previewCardTitle: 'Scholar Teaching Suite',
            previewBadge: 'Sanad Verified Tutor'
        },
        {
            id: 'institutions',
            roleName: 'For Academies & Schools',
            roleTitleArabic: 'للمؤسسات والمراكز القرأنية',
            badge: 'Enterprise & LMS',
            icon: Building2,
            tagline: 'Scale your Islamic institution or school with our custom enterprise Quran learning management system.',
            highlights: [
                'Custom white-label branding for your academy or school',
                'Bulk student & tutor onboarding with hierarchical permissions',
                'Advanced institutional analytics, curriculum & certificate issuance',
                'Dedicated account manager and 24/7 technical infrastructure'
            ],
            statNumber: '99.9%',
            statLabel: 'Uptime & Reliability',
            quote: '“وتعاونوا على البر والتقوى”',
            surahReference: 'Surah Al-Ma’idah — Ayah 2',
            ctaText: 'Partner With Us',
            ctaLink: '/institutions',
            previewCardTitle: 'Institutional Management Hub',
            previewBadge: 'Enterprise Suite'
        }
    ];

    // Auto-cycle tabs every 10 seconds
    useEffect(() => {
        if (!isAutoPlaying) return;

        const timer = setInterval(() => {
            setActiveRole((prevRole) => (prevRole + 1) % roles.length);
        }, 10000);

        return () => clearInterval(timer);
    }, [activeRole, isAutoPlaying, roles.length]);

    const currentRole = roles[activeRole];

    const handleRoleClick = (index: number) => {
        setActiveRole(index);
    };

    return (
        <section className="relative w-full py-20 md:py-28 overflow-hidden bg-background border-b border-border/40">

            {/* Background Glow Effects */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary/10 via-accent/5 to-transparent blur-[150px] rounded-full pointer-events-none -z-10 animate-[pulse_7s_ease-in-out_infinite]" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />

            {/* Container */}
            <div className="container max-w-7xl px-4 md:px-6 mx-auto space-y-12 md:space-y-16">

                {/* Header */}
                <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-md text-primary text-xs md:text-sm font-semibold">
                        <Users className="h-4 w-4 text-accent" />
                        <span className="uppercase tracking-wider">Designed For Everyone</span>
                    </div>

                    <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.12]">
                        Tailored Experience For{' '}
                        <span className="text-primary">
                            Every Role
                        </span>
                    </h2>

                    <p className="text-muted-foreground text-base sm:text-lg leading-relaxed font-normal">
                        Whether you are a student striving for Ijazah, a parent securing your family’s Quranic foundation, or a scholar sharing your Sanad.
                    </p>
                </div>

                {/* Role Switcher Tabs & AutoPlay Controls */}
                <div className="flex flex-col items-center gap-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-5xl w-full mx-auto">
                        {roles.map((role, idx) => {
                            const Icon = role.icon;
                            const isActive = activeRole === idx;
                            return (
                                <button
                                    key={role.id}
                                    onClick={() => handleRoleClick(idx)}
                                    className={`flex flex-col items-center text-center p-4 md:p-5 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden ${isActive
                                        ? 'bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/25 scale-[1.02]'
                                        : 'bg-card/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-primary/40'
                                        }`}
                                >
                                    <div className={`p-3 rounded-xl mb-3 transition-colors ${isActive ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-primary/10 text-primary'
                                        }`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <span className="text-sm md:text-base font-extrabold">{role.roleName}</span>
                                    <span className={`text-xs mt-1 font-serif ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                        {role.roleTitleArabic}
                                    </span>

                                    {/* 10-Second Timer Progress Bar for Active Tab */}
                                    {isActive && isAutoPlaying && (
                                        <div
                                            key={activeRole}
                                            className="absolute bottom-0 left-0 h-1 bg-accent animate-[roleTimerProgress_10s_linear_infinite]"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Pause / Play Auto Rotation Button */}
                    <button
                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card/60 border border-border/50 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isAutoPlaying ? (
                            <>
                                <Pause className="h-3.5 w-3.5 text-primary animate-pulse" />
                                <span>Auto-cycling roles every 10s (Click to pause)</span>
                            </>
                        ) : (
                            <>
                                <Play className="h-3.5 w-3.5 text-primary" />
                                <span>Paused (Click to resume auto-cycle)</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Active Role Content Card */}
                <div key={currentRole.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center p-6 md:p-10 rounded-[32px] bg-card/40 border border-border/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] transition-all duration-500">

                    {/* Left Column: Role Details */}
                    <div className="lg:col-span-7 space-y-6">

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                                <Sparkles className="h-3.5 w-3.5" />
                                {currentRole.badge}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground border-l border-border/60 pl-3">
                                {currentRole.roleTitleArabic}
                            </span>
                        </div>

                        <h3 className="text-2xl sm:text-4xl font-black text-foreground leading-snug">
                            {currentRole.roleName}: {currentRole.tagline}
                        </h3>

                        {/* Bullet points */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            {currentRole.highlights.map((point, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border/40">
                                    <div className="p-1 rounded-full bg-primary/20 text-primary mt-0.5 shrink-0">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <span className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">
                                        {point}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Quranic Verse / Inspirational Banner */}
                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/15 space-y-1.5">
                            <p className="text-sm sm:text-base font-bold font-serif text-foreground text-center dir-rtl">
                                {currentRole.quote}
                            </p>
                            <p className="text-[11px] text-muted-foreground text-center font-semibold">
                                — {currentRole.surahReference}
                            </p>
                        </div>

                        {/* CTA & Stat Bar */}
                        <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-border/50">
                            <div>
                                <p className="text-2xl sm:text-3xl font-black text-foreground">{currentRole.statNumber}</p>
                                <p className="text-xs text-muted-foreground font-semibold">{currentRole.statLabel}</p>
                            </div>
                            <Link href={currentRole.ctaLink}>
                                <Button size="lg" className="w-full sm:w-auto h-12 px-7 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg rounded-xl transition-all">
                                    <span>{currentRole.ctaText}</span>
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </Link>
                        </div>

                    </div>

                    {/* Right Column: Visual Preview Card */}
                    <div className="lg:col-span-5 relative flex justify-center items-center">

                        {/* Ambient Lighting */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 via-accent/15 to-primary/5 blur-3xl rounded-[32px] opacity-80 -z-10" />

                        {/* Glassmorphic Mockup Box */}
                        <div className="relative w-full aspect-square max-w-md rounded-[28px] overflow-hidden border border-border/80 bg-background/80 backdrop-blur-2xl p-6 shadow-2xl flex flex-col justify-between">

                            {/* Top Mockup Header */}
                            <div className="flex items-center justify-between pb-4 border-b border-border/50">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-primary/15 text-primary">
                                        <Lock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-foreground">{currentRole.previewCardTitle}</p>
                                        <p className="text-[10px] text-muted-foreground">Encrypted & Authenticated</p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                                    {currentRole.previewBadge}
                                </span>
                            </div>

                            {/* Center Visual Mock Features */}
                            <div className="my-auto space-y-4 py-4">
                                <div className="p-4 rounded-xl bg-card border border-border/60 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                                            <Award className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground">Verified Sanad Certificate</p>
                                            <p className="text-[10px] text-muted-foreground">Classically authenticated</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center text-amber-500 text-xs font-bold gap-1">
                                        <Star className="h-3.5 w-3.5 fill-amber-500" />
                                        <span>4.9/5</span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-card border border-border/60 shadow-sm space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-semibold text-foreground">Role Mastery Index</span>
                                        <span className="font-bold text-primary">98% Progress</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full w-[98%]" />
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Card Footer */}
                            <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground font-medium">
                                <span className="flex items-center gap-1">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    <span>Sanad Verified</span>
                                </span>
                                <span className="text-primary font-bold hover:underline cursor-pointer flex items-center">
                                    View Full Specs
                                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                                </span>
                            </div>

                        </div>

                    </div>

                </div>

            </div>

            {/* Timer Progress Keyframe Animation */}
            <style jsx>{`
                @keyframes roleTimerProgress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>
        </section>
    );
}

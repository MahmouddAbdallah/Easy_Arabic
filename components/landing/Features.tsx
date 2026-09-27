'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Video, BarChart3, Users, Sparkles, CheckCircle2, ArrowRight, Radio, BookOpen, Award, Mic, Clock, Lock, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Features() {
    const [activeTab, setActiveTab] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    const featureTabs = [
        {
            id: 'sanad',
            label: 'Sanad Verification',
            icon: ShieldCheck,
            badge: '100% Authenticated',
            title: 'Direct Oral Transmission Linked to Classical Scholars',
            description: 'Every instructor on our platform is evaluated through a strict 5-stage academic audit to guarantee verified chains of transmission (Sanad) with Ijazah credentials.',
            points: [
                'Verifiable chain of recitation back to Prophet Muhammad ﷺ',
                'Graduates from Al-Azhar & Islamic University of Madinah',
                'Continuous peer oversight & Tajweed audit committees'
            ],
            previewTag: 'Sanad Audit Complete',
            statValue: '100%',
            statLabel: 'Certified Ijazah Holders',
            surahName: 'Surah Fatir — Ayah 28',
            quranVerse: 'إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ',
            translation: 'Only those fear Allah, from among His servants, who have knowledge.'
        },
        {
            id: 'studio',
            label: 'Interactive Classroom',
            icon: Video,
            badge: 'Ultra HD Audio & Video',
            title: 'Immersive Real-Time Recitation Studio',
            description: 'Experience low-latency crystal-clear audio paired with an interactive digital Mushaf, real-time color-coded Tajweed correction, and dual-way stroke tools.',
            points: [
                'Spatial audio optimized for delicate phonetic nuances',
                'Interactive synchronized Digital Mushaf annotation',
                'Instant audio session recording for revision & Muraqa\'ah'
            ],
            previewTag: 'Live HD Recitation Stream',
            statValue: '<30ms',
            statLabel: 'Ultra-Low Latency',
            surahName: 'Surah An-Nur — Ayah 35',
            quranVerse: 'اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ',
            translation: 'Allah is the Light of the heavens and the earth.'
        },
        {
            id: 'family',
            label: 'Household Portal',
            icon: Users,
            badge: 'Family Unified',
            title: 'Effortless Household Management Dashboard',
            description: 'Seamlessly coordinate Quranic journeys for multiple family members, track individual milestones, and adjust schedules from one elegant sanctuary.',
            points: [
                'Dedicated sub-profiles for children & adult learners',
                'Direct private messaging with Sanad instructors',
                'Unified billing & flexible global schedule management'
            ],
            previewTag: 'Active Family Dashboard',
            statValue: '1 Dashboard',
            statLabel: 'Complete Household Control',
            surahName: 'Surah At-Tahrim — Ayah 6',
            quranVerse: 'يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنفُسَكُمْ وَأَهْلِيكُمْ نَارًا',
            translation: 'O you who have believed, protect yourselves and your families from a Fire.'
        },
        {
            id: 'analytics',
            label: 'Hifz Tracker',
            icon: BarChart3,
            badge: 'AI-Enhanced Insights',
            title: 'Precision Memorization & Revision Analytics',
            description: 'Never lose track of Hifz retention. Automated Muraqa\'ah schedules and teacher assessment logs ensure long-term mastery without fatigue.',
            points: [
                'Visual progress maps for Juz, Surah & Ayah completion',
                'Customized revision intervals based on recall algorithms',
                'Detailed weekly Tajweed & pronunciation report cards'
            ],
            previewTag: 'Real-Time Progress Metrics',
            statValue: '99.4%',
            statLabel: 'Retention Success Rate',
            surahName: 'Surah Al-Qamar — Ayah 17',
            quranVerse: 'وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ',
            translation: 'And We have certainly made the Quran easy for remembrance.'
        }
    ];

    // Auto-cycle tabs every 10 seconds (10000 ms)
    useEffect(() => {
        if (!isAutoPlaying) return;

        const timer = setInterval(() => {
            setActiveTab((prevTab) => (prevTab + 1) % featureTabs.length);
        }, 10000);

        return () => clearInterval(timer);
    }, [activeTab, isAutoPlaying, featureTabs.length]);

    const currentFeature = featureTabs[activeTab];

    const handleTabClick = (index: number) => {
        setActiveTab(index);
    };

    return (
        <section className="relative w-full py-20 md:py-28 overflow-hidden bg-background border-b border-border/40">

            {/* ---------------- 1. LUXURY LIGHTING & GLOWS ---------------- */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-primary/15 via-accent/10 to-transparent blur-[160px] rounded-full pointer-events-none -z-10 animate-[pulse_7s_ease-in-out_infinite]" />
            <div className="absolute bottom-10 -right-32 w-[500px] h-[500px] bg-primary/10 blur-[180px] rounded-full pointer-events-none -z-10" />

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_75%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

            {/* ---------------- 2. CONTAINER ---------------- */}
            <div className="container max-w-7xl px-4 md:px-6 mx-auto space-y-12 md:space-y-16">

                {/* Header */}
                <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-2xl text-primary text-xs md:text-sm font-semibold shadow-sm">
                        <Sparkles className="h-4 w-4 text-accent animate-pulse" />
                        <span className="tracking-wide uppercase">Engineered For Excellence</span>
                    </div>

                    <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.12]">
                        The Pillars of{' '}
                        <span className="text-primary ">
                            World-Class Learning
                        </span>
                    </h2>

                    <p className="text-muted-foreground text-base sm:text-lg leading-relaxed font-normal">
                        A harmonious blend of authentic scholarship and state-of-the-art interactive technology tailored specifically for modern households.
                    </p>
                </div>

                {/* Interactive Navigation Tabs + AutoPlay Toggle */}
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center justify-start md:justify-center gap-2 md:gap-3 overflow-x-auto pb-2 w-full scrollbar-none">
                        {featureTabs.map((tab, idx) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === idx;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabClick(idx)}
                                    className={`relative flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-300 shrink-0 cursor-pointer overflow-hidden ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-[0_0_25px_-5px_rgba(0,0,0,0.3)] shadow-primary/40 scale-105'
                                        : 'bg-card/40 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card/80'
                                        }`}
                                >
                                    <Icon className={`h-4 w-4 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                                    <span>{tab.label}</span>

                                    {/* 10s Timer progress bar overlay for active tab */}
                                    {isActive && isAutoPlaying && (
                                        <span
                                            key={activeTab}
                                            className="absolute bottom-0 left-0 h-[3px] bg-accent animate-[timerProgress_10s_linear_infinite]"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Pause / Resume Auto Rotation Toggle */}
                    <button
                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card/60 border border-border/50 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isAutoPlaying ? (
                            <>
                                <Pause className="h-3 w-3 text-primary animate-pulse" />
                                <span>Auto-cycling every 10s (Click to pause)</span>
                            </>
                        ) : (
                            <>
                                <Play className="h-3 w-3 text-primary" />
                                <span>Paused (Click to resume auto-cycle)</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Main Feature Showcase Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center p-6 md:p-10 rounded-[32px] bg-card/40 border border-border/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] transition-all duration-500">

                    {/* LEFT COLUMN: Feature Description & Details */}
                    <div className="lg:col-span-6 space-y-6">

                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                            <Award className="h-3.5 w-3.5" />
                            <span>{currentFeature.badge}</span>
                        </div>

                        <h3 className="text-2xl sm:text-4xl font-extrabold text-foreground leading-snug">
                            {currentFeature.title}
                        </h3>

                        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                            {currentFeature.description}
                        </p>

                        {/* Bullet points */}
                        <div className="space-y-3 pt-2">
                            {currentFeature.points.map((point, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="p-1 rounded-full bg-primary/20 text-primary mt-0.5 shrink-0">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <span className="text-xs sm:text-sm text-foreground font-semibold leading-normal">
                                        {point}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Quick Stats Bar */}
                        <div className="pt-4 flex items-center justify-between border-t border-border/50">
                            <div>
                                <p className="text-2xl sm:text-3xl font-black text-foreground">{currentFeature.statValue}</p>
                                <p className="text-xs text-muted-foreground font-medium">{currentFeature.statLabel}</p>
                            </div>
                            <Link href="/register">
                                <Button size="lg" className="h-12 px-6 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transition-all rounded-xl">
                                    <span>Experience Feature</span>
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </Link>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Dynamic Interactive Mushaf Studio Frame */}
                    <div className="lg:col-span-6 relative flex justify-center items-center">

                        {/* Ambient Glow */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-accent/20 to-primary/10 blur-3xl rounded-[32px] opacity-70 -z-10" />

                        {/* Outer Glass Card */}
                        <div className="relative w-full aspect-[4/3] min-h-[380px] rounded-[24px] overflow-hidden border border-border/80 bg-background/80 backdrop-blur-2xl p-4 shadow-2xl flex flex-col justify-between transition-all duration-700">

                            {/* Top Mock Window Bar */}
                            <div className="flex items-center justify-between pb-3 border-b border-border/50">
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                    <Lock className="h-3.5 w-3.5 text-primary" />
                                    <span>quran.platform/{currentFeature.id}</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                                    <Radio className="h-3 w-3 animate-pulse" />
                                    <span>{currentFeature.previewTag}</span>
                                </div>
                            </div>

                            {/* Central DYNAMIC Quranic Content Display */}
                            <div key={currentFeature.id} className="my-auto py-4 flex flex-col items-center text-center space-y-4 animate-fade-in-up">

                                <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-inner">
                                    <BookOpen className="h-8 w-8 animate-bounce" />
                                </div>

                                <div className="space-y-2 max-w-md px-2">
                                    <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-3 py-1 rounded-full">
                                        {currentFeature.surahName}
                                    </span>
                                    <p className="text-base sm:text-xl font-bold text-foreground font-serif leading-loose dir-rtl pt-2">
                                        {currentFeature.quranVerse}
                                    </p>
                                    <p className="text-xs text-muted-foreground italic">
                                        {currentFeature.translation}
                                    </p>
                                </div>

                                {/* Audio Waveform Simulation */}
                                <div className="flex items-center gap-1.5 h-6 pt-1">
                                    {[40, 75, 30, 90, 60, 100, 45, 80, 35, 70].map((height, i) => (
                                        <div
                                            key={i}
                                            style={{ height: `${height}%` }}
                                            className="w-1 bg-primary/80 rounded-full animate-pulse"
                                        />
                                    ))}
                                </div>

                            </div>

                            {/* Bottom Live Feedback Bar */}
                            <div className="p-3 rounded-xl bg-card/90 border border-border/60 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Mic className="h-4 w-4 text-primary animate-pulse" />
                                    <span className="text-xs font-semibold text-foreground">Active Recitation Studio</span>
                                </div>
                                <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                    Synced
                                </span>
                            </div>

                        </div>

                    </div>

                </div>

                {/* Bottom 3-Column Micro Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                    {[
                        {
                            icon: Clock,
                            title: "Flexibility First",
                            desc: "Reschedule or pause subscriptions instantly with zero penalty."
                        },
                        {
                            icon: ShieldCheck,
                            title: "Female & Male Scholars",
                            desc: "Select preferred tutors for sisters, brothers, and young children."
                        },
                        {
                            icon: Sparkles,
                            title: "Progress Certificates",
                            desc: "Earn accredited certificates upon completing each Juz & Tajweed level."
                        }
                    ].map((item, index) => {
                        const MiniIcon = item.icon;
                        return (
                            <div key={index} className="p-5 rounded-2xl bg-card/40 border border-border/60 backdrop-blur-md flex items-start gap-4 transition-all duration-300 hover:bg-card/70 hover:border-primary/40">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                                    <MiniIcon className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>

            {/* Tailwind Keyframe Animation in Inline Style for timerProgress */}
            <style jsx>{`
                @keyframes timerProgress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>
        </section>
    );
}
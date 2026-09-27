import BackgroundImage from '@/components/auth/BackgroundImage'
import SignUpForm from '@/components/auth/SignUpForm'
import { BookOpen } from 'lucide-react'
import Image from 'next/image'

const Page = () => {
    return (
        <div className="relative h-screen flex items-center justify-center p-4 sm:p-6 md:p-10 overflow-hidden bg-background">
            <BackgroundImage />
            <div className="absolute size-150 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="relative w-full max-w-4xl bg-card/95 backdrop-blur-sm border border-border/80 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
                <div className="relative hidden md:flex flex-col justify-between p-8 bg-muted/40 border-r border-border/50 overflow-hidden">
                    <Image
                        src="/sign-up.jpg" // 👈 غيّر المسار لصورتك (مثلاً صورة مصحف أو خلفية قرآنية)
                        alt="Quran Signup Illustration"
                        fill
                        priority
                        className="object-cover opacity-90 transition-transform duration-500 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
                    <div className="relative z-10 flex items-center gap-2 text-white">
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-wide">Quran App</span>
                    </div>
                    <div className="relative z-10 text-white space-y-2">
                        <blockquote className="text-lg font-medium leading-snug">
                            The best among you are those who learn the Quran and teach it.
                        </blockquote>
                        <p className="text-xs text-white/70">Prophet Muhammad (ﷺ)</p>
                    </div>
                </div>
                <div className="p-6 sm:p-10 flex flex-col justify-center space-y-6">

                    <div className="space-y-1 text-left">
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">
                            Create an account
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Fill in your details below to get started
                        </p>
                    </div>
                    <SignUpForm />
                </div>

            </div>
        </div>
    )
}

export default Page
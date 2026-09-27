'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Sparkles, Send, PhoneCall, Mail, ShieldCheck, CheckCircle2, Headphones, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';

export default function ContactHero() {
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting }, } = useForm({
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      topic: 'enrollment',
      message: '',
    },
  });

  const onSubmit = async (data: any) => {
    console.log('Form Data Submitted:', data);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    setSubmitted(true);
  };

  return (
    <section className="relative w-full h-screen min-h-[850px] max-h-[1080px] overflow-hidden bg-background flex items-center justify-center border-b border-border/40">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-linear-to-b from-primary/20 via-accent/10 to-transparent blur-[160px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/2 -left-40 -translate-y-1/2 w-[550px] h-[550px] bg-secondary/15 blur-[180px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 -right-32 w-[600px] h-[600px] bg-primary/10 blur-[180px] rounded-full pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-[linear-linear(to_right,#80808012_1px,transparent_1px),linear-linear(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-linear(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none -z-10" />
      <div className="container max-w-7xl px-4 md:px-6 h-full flex flex-col justify-between py-8 md:py-12">

        <div className="h-2" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto">
          <div className="lg:col-span-6 flex flex-col items-start space-y-6 lg:space-y-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-2xl text-primary text-xs md:text-sm font-semibold shadow-[0_0_20px_-3px_rgba(0,0,0,0.2)] shadow-primary/20">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="tracking-wide">Support Desk Active • Response &lt; 15 mins</span>
              <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
              We Are Here to Support Your Family’s{' '}Sacred Journey
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-lg font-normal leading-relaxed">
              Have questions about tutor selection, custom scheduling, or family plans? Our dedicated concierge team is ready to guide you every step of the way.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-2">
              <div className="p-4 rounded-2xl bg-card/40 border border-border/60 backdrop-blur-xl flex items-start gap-3.5 shadow-sm hover:border-primary/40 transition-colors">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Direct Line</h3>
                  <p className="text-sm font-semibold text-foreground mt-0.5">+1 (800) 555-QURAN</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Mon - Sat, 8am - 10pm EST</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-card/40 border border-border/60 backdrop-blur-xl flex items-start gap-3.5 shadow-sm hover:border-primary/40 transition-colors">
                <div className="p-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Email Us</h3>
                  <p className="text-sm font-semibold text-foreground mt-0.5">support@quranapp.com</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">24/7 Priority Mail Service</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground pt-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Encrypted & Confidential</span>
              </div>
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-primary" />
                <span>Dedicated Family Advisor</span>
              </div>
            </div>

          </div>
          <div className="lg:col-span-6 relative flex justify-center items-center">

            <div className="absolute inset-0 bg-linear-to-tr from-primary/30 via-accent/20 to-secondary/30 blur-3xl rounded-[40px] opacity-80 -z-10" />

            <div className="relative w-full max-w-lg rounded-[28px] border border-border/80 bg-card/50 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">

              {submitted ? (
                <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
                  <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-bounce">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground">Message Received</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Thank you for reaching out. One of our family advisors will get back to you within a few minutes.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSubmitted(false);
                      reset();
                    }}
                    className="mt-4 rounded-xl border-border/80"
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">

                  <div className="space-y-1 mb-1">
                    <h2 className="text-xl font-bold text-foreground">Send us a Message</h2>
                    <p className="text-xs text-muted-foreground">Fill out the details below and we will tailor our response for your family.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Full Name</label>
                    <Input
                      placeholder="e.g. Dr. Ahmed Al-Mansoor"
                      {...register('fullName')}
                      className="h-10 rounded-xl border-border/80 bg-background/60 backdrop-blur-md text-sm focus-visible:ring-primary/50"
                    />
                    {errors.fullName && (
                      <p className="text-[11px] font-medium text-destructive">{errors.fullName.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground">Email Address</label>
                      <Input
                        type="email"
                        placeholder="ahmed@example.com"
                        {...register('email')}
                        className="h-10 rounded-xl border-border/80 bg-background/60 backdrop-blur-md text-sm focus-visible:ring-primary/50"
                      />
                      {errors.email && (
                        <p className="text-[11px] font-medium text-destructive">{errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground">Phone Number</label>
                      <Input
                        placeholder="+1 (555) 000-0000"
                        {...register('phone')}
                        className="h-10 rounded-xl border-border/80 bg-background/60 backdrop-blur-md text-sm focus-visible:ring-primary/50"
                      />
                      {errors.phone && (
                        <p className="text-[11px] font-medium text-destructive">{errors.phone.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Topic of Inquiry</label>
                    <Select>
                      <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background/60 backdrop-blur-md text-sm focus:ring-primary/50">
                        <SelectValue placeholder="Select a topic" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/80 bg-card/95 backdrop-blur-xl">
                        <SelectItem value="enrollment">Family Membership & Enrollment</SelectItem>
                        <SelectItem value="tutor">Request Specific Sanad Tutor</SelectItem>
                        <SelectItem value="custom">Custom Schedule & Private Classes</SelectItem>
                        <SelectItem value="other">General Question</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.topic && (
                      <p className="text-[11px] font-medium text-destructive">{errors.topic.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Your Message</label>
                    <Textarea
                      rows={3}
                      placeholder="How can we help your family's Quran learning goals?"
                      {...register('message')}
                      className="rounded-xl border-border/80 bg-background/60 backdrop-blur-md text-sm focus-visible:ring-primary/50 resize-none"
                    />
                    {errors.message && (
                      <p className="text-[11px] font-medium text-destructive">{errors.message.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full h-11 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_25px_-5px_rgba(0,0,0,0.3)] shadow-primary/40 transition-all hover:scale-[1.01] active:scale-[0.98] rounded-xl mt-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        <span>Sending Message...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <Send className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                </form>
              )}

            </div>

          </div>

        </div>
        <div className="pt-6 border-t border-border/40 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center">
            <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Global Offices</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">USA • UK • UAE • Egypt</p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight">&lt; 15 Mins</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Average Response Time</p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight">24/7 Coverage</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">All Timezones Supported</p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight">100% Privacy</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Data Protection Guaranteed</p>
          </div>
        </div>

      </div>
    </section>
  );
}
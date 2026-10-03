import { Mail, PhoneCall, Clock3, Languages, GraduationCap } from 'lucide-react';
import { phoneHref } from '@/lib/contact/helpers';
import type { ContactInfoFields } from '@/lib/contact/types';
import ContactForm from './ContactForm';

type Props = { info: ContactInfoFields };

export default function ContactHero({ info }: Props) {
  const highlights = [
    { icon: Clock3, label: 'Response time', value: info.responseTime },
    { icon: Languages, label: 'Support languages', value: info.supportLanguages },
    { icon: GraduationCap, label: 'Trial lessons', value: info.trialLessonText },
  ];

  return (
    <section className="relative w-full overflow-hidden bg-background border-b border-border/40">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-225 h-125 bg-linear-to-b from-primary/20 via-accent/10 to-transparent blur-[160px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/2 -left-40 -translate-y-1/2 size-138 bg-secondary/15 blur-[180px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 -right-32 size-150 bg-primary/10 blur-[180px] rounded-full pointer-events-none -z-10" />

      <div className="container max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6 flex flex-col items-start space-y-6 lg:space-y-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-2xl text-primary text-xs md:text-sm font-semibold">
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="tracking-wide">{info.heroBadgeText}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1] text-balance">
              {info.heroHeadline}
            </h1>

            <p className="text-muted-foreground text-base sm:text-lg max-w-lg font-normal leading-relaxed">
              {info.heroDescription}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-2">
              <a
                href={phoneHref(info.phoneNumber)}
                className="p-4 rounded-2xl bg-card/40 border border-border/60 backdrop-blur-xl flex items-start gap-3.5 shadow-sm hover:border-primary/40 transition-colors min-w-0"
              >
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{info.phoneLabel}</h3>
                  <p className="text-sm font-semibold text-foreground mt-0.5 break-words">{info.phoneNumber}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{info.phoneNote}</p>
                </div>
              </a>

              <a
                href={`mailto:${info.supportEmail}`}
                className="p-4 rounded-2xl bg-card/40 border border-border/60 backdrop-blur-xl flex items-start gap-3.5 shadow-sm hover:border-primary/40 transition-colors min-w-0"
              >
                <div className="p-2.5 rounded-xl bg-accent/10 text-accent-foreground border border-accent/20 shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{info.supportEmailLabel}</h3>
                  <p className="text-sm font-semibold text-foreground mt-0.5 break-all">{info.supportEmail}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{info.supportEmailNote}</p>
                </div>
              </a>
            </div>
          </div>

          <div className="lg:col-span-6 relative flex justify-center items-center">
            <div className="absolute inset-0 bg-linear-to-tr from-primary/30 via-accent/20 to-secondary/30 blur-3xl rounded-[40px] opacity-60 -z-10" />
            <div className="relative w-full max-w-lg rounded-[28px] border border-border/80 bg-card/60 backdrop-blur-2xl p-6 sm:p-8 shadow-xl">
              <ContactForm
                title={info.formTitle}
                description={info.formDescription}
                successTitle={info.formSuccessTitle}
                successMessage={info.formSuccessMessage}
              />
            </div>
          </div>
        </div>

        <dl className="mt-12 md:mt-16 pt-6 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {highlights.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 sm:justify-center">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="text-sm font-bold text-foreground">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

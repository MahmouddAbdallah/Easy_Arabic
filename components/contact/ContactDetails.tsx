import { ArrowUpRight, MapPin, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAddressLines, mapDirectionsUrl, mapEmbedUrl } from '@/lib/contact/helpers';
import type { BusinessHourRecord, ContactInfoFields } from '@/lib/contact/types';
import BusinessHoursCard from './BusinessHoursCard';

type Props = { info: ContactInfoFields; hours: BusinessHourRecord[] };

export default function ContactDetails({ info, hours }: Props) {
  const addressLines = formatAddressLines(info);

  return (
    <section className="relative w-full py-16 md:py-24 bg-background border-b border-border/40">
      <div className="container max-w-7xl px-4 md:px-6 mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 rounded-[28px] border border-border/80 bg-card/40 backdrop-blur-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{info.officeName}</h3>
                  <address className="not-italic text-sm text-muted-foreground leading-relaxed mt-1">
                    {addressLines.map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </address>
                </div>
              </div>

              <a href={mapDirectionsUrl(info.latitude, info.longitude)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Button variant="outline" size="sm" className="rounded-xl border-border/80 w-full sm:w-auto">
                  <span>Get directions</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>

            <iframe
              title={`Map showing ${info.officeName}`}
              src={mapEmbedUrl(info.latitude, info.longitude)}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full flex-1 min-h-72 border-t border-border/50 bg-muted"
            />

            {info.billingEmail && (
              <div className="px-6 py-4 border-t border-border/50 flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Billing &amp; payments:</span>
                <a href={`mailto:${info.billingEmail}`} className="font-semibold text-foreground hover:text-primary break-all">
                  {info.billingEmail}
                </a>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <BusinessHoursCard hours={hours} timezone={info.timezone} note={info.businessHoursNote} />
          </div>
        </div>
      </div>
    </section>
  );
}

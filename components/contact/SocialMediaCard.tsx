import { Share2, ArrowUpRight, MessageCircle } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterXIcon } from '../icons';
import { handleFromUrl, whatsappHref } from '@/lib/contact/helpers';
import type { ContactInfoFields } from '@/lib/contact/types';

type Props = { info: ContactInfoFields };

export default function SocialMediaCard({ info }: Props) {
  const socialLinks = [
    { name: 'LinkedIn', href: info.linkedinUrl, icon: LinkedinIcon, color: 'hover:text-[#0A66C2] hover:bg-[#0A66C2]/10' },
    { name: 'Instagram', href: info.instagramUrl, icon: InstagramIcon, color: 'hover:text-[#E4405F] hover:bg-[#E4405F]/10' },
    { name: 'Facebook', href: info.facebookUrl, icon: FacebookIcon, color: 'hover:text-[#1877F2] hover:bg-[#1877F2]/10' },
    { name: 'X / Twitter', href: info.xUrl, icon: TwitterXIcon, color: 'hover:text-foreground hover:bg-foreground/10' },
  ].filter((link): link is typeof link & { href: string } => !!link.href);

  const hasWhatsapp = !!info.whatsappNumber;

  if (!socialLinks.length && !hasWhatsapp) return null;

  return (
    <Card className="rounded-[28px] border-border/80 bg-card/40 backdrop-blur-2xl shadow-xl p-6 space-y-6">
      {socialLinks.length > 0 && (
        <>
          <CardHeader className="p-0 flex flex-row items-center gap-3 pb-4 border-b border-border/50">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Connect with us</h4>
              <p className="text-xs text-muted-foreground">Follow our social channels</p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
              {socialLinks.map(({ name, href, icon: Icon, color }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3.5 rounded-xl bg-background/60 border border-border/60 backdrop-blur-md flex items-center justify-between transition-all duration-200 group ${color}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-current transition-colors" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-foreground truncate">{name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{handleFromUrl(href)}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                </a>
              ))}
            </div>
          </CardContent>
        </>
      )}

      {hasWhatsapp && (
        <div className="p-4 rounded-2xl bg-linear-to-br from-primary/10 via-accent/5 to-transparent border border-primary/20 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <MessageCircle className="h-4 w-4" />
            <span>{info.whatsappTitle}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{info.whatsappDescription}</p>
          <a
            href={whatsappHref(info.whatsappNumber!, info.whatsappPrefilledMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button size="sm" className="w-full h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md">
              {info.whatsappButtonLabel}
            </Button>
          </a>
        </div>
      )}
    </Card>
  );
}

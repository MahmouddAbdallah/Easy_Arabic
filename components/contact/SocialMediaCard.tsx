import {
    Share2,
    ArrowUpRight,
    MessageCircle,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterXIcon } from "../icons";

const socialLinks = [
    {
        name: "LinkedIn",
        handle: "@company-name",
        icon: LinkedinIcon,
        color: "hover:text-[#0A66C2] hover:bg-[#0A66C2]/10",
        href: "https://linkedin.com",
    },
    {
        name: "Instagram",
        handle: "@company_handle",
        icon: InstagramIcon,
        color: "hover:text-[#E4405F] hover:bg-[#E4405F]/10",
        href: "https://instagram.com",
    },
    {
        name: "Facebook",
        handle: "CompanyPage",
        icon: FacebookIcon,
        color: "hover:text-[#1877F2] hover:bg-[#1877F2]/10",
        href: "https://facebook.com",
    },
    {
        name: "Twitter / X",
        handle: "@company_x",
        icon: TwitterXIcon,
        color: "hover:text-foreground hover:bg-foreground/10",
        href: "https://twitter.com",
    },
];

export default function SocialMediaCard() {
    return (
        <div className="lg:col-span-5">
            <Card className="rounded-[28px] border-border/80 bg-card/40 backdrop-blur-2xl shadow-xl p-6 space-y-6">
                <CardHeader className="p-0 flex-row items-center justify-between pb-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <Share2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-foreground">Connect With Us</h4>
                            <p className="text-xs text-muted-foreground">Follow our social channels</p>
                        </div>
                    </div>

                    <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                </CardHeader>

                <CardContent className="p-0 space-y-6">
                    {/* Social Links Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {socialLinks.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <a
                                    key={i}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`p-3.5 rounded-xl bg-background/60 border border-border/60 backdrop-blur-md flex items-center justify-between transition-all duration-200 group ${item.color}`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-current transition-colors" />
                                        <div className="truncate">
                                            <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{item.handle}</p>
                                        </div>
                                    </div>
                                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                                </a>
                            );
                        })}
                    </div>

                    {/* Instant WhatsApp Callout */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border border-primary/20 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-primary">
                            <MessageCircle className="h-4 w-4" />
                            <span>Need Instant Support?</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Prefer direct chat? Reach out directly to our team on WhatsApp for fast responses.
                        </p>
                        <Button
                            size="sm"
                            className="w-full h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all"
                        >
                            <a href="https://wa.me/your-number" target="_blank" rel="noopener noreferrer">
                                Chat on WhatsApp Now
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
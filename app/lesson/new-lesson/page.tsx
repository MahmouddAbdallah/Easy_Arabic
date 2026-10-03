import Link from 'next/link';
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LessonForm from '@/components/lesson/LessonForm';

export default function AddLessonPage() {
    return (
        <div className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden bg-background">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative w-full max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between px-1">
                    <Link href="/lesson">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-background/80 backdrop-blur-xs transition-all"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            <span>Back to Lessons</span>
                        </Button>
                    </Link>

                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-background/60 backdrop-blur-xs text-[11px] font-normal gap-1 border-border/80 text-muted-foreground">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            <span>Quick Entry</span>
                        </Badge>
                    </div>
                </div>
                <div className="relative rounded-xl border border-border/80 bg-card/80 backdrop-blur-md shadow-xl overflow-hidden transition-all">
                    <LessonForm
                        isEditing={false}
                        view='HORIZONTAL'
                    />
                </div>
                <p className="text-center text-[11px] text-muted-foreground/70 pt-1">
                    Pressing save will automatically notify the assigned teacher and student.
                </p>
            </div>
        </div>
    );
}
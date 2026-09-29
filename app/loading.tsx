import { LogoLoadingIcon } from '../components/icons'

const Loading = () => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-background/80 backdrop-blur-xl transition-all duration-500">
            <div className="absolute -z-10 size-75 rounded-full bg-primary/20 blur-[120px] animate-pulse" />

            <div className="relative flex flex-col items-center justify-center gap-6">

                <div className="relative flex items-center justify-center">
                    <div className="absolute h-36 w-36 rounded-full border-2 border-primary/20 border-t-primary animate-spin animation-duration-[3s]" />
                    <div className="absolute h-44 w-44 rounded-full border border-primary/10 border-b-primary/40 animate-spin animation-duration-[6s] shimmer-reverse" />

                    <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl bg-card/40 p-4 shadow-2xl backdrop-blur-md border border-white/10 dark:border-white/5">
                        <LogoLoadingIcon className="h-20 w-20 text-primary animate-pulse transition-transform duration-700 hover:scale-105" />
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <span className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase animate-pulse">
                        Loading...
                    </span>

                    <div className="h-0.5 w-32 overflow-hidden rounded-full bg-primary/10">
                        <div className="h-full w-full bg-linear-to-r from-transparent via-primary to-transparent animate-[shimmer_1.5s_infinite] bg-size-[200%_100%]" />
                    </div>
                </div>

            </div>
        </div>
    )
}

export default Loading
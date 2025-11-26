import { Skeleton } from "@/components/ui/skeleton";

export const ChatMessagesSkeleton = () => {
    return (
        <div className="flex-1 flex flex-col py-4 px-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-x-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex flex-col gap-y-2 flex-1">
                        <div className="flex items-center gap-x-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-4 w-full max-w-md" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export const ServerSidebarSkeleton = () => {
    return (
        <div className="flex flex-col h-full w-full bg-[#F2F3F5] dark:bg-[#2B2D31] p-3 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-8 w-3/4" />
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
            ))}
        </div>
    );
};

export const NavigationSidebarSkeleton = () => {
    return (
        <div className="flex flex-col items-center h-full w-full bg-[#E3E5E8] dark:bg-[#1E1F22] py-3 space-y-4">
            <Skeleton className="h-12 w-12 rounded-[24px]" />
            <div className="w-10 h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md" />
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-12 rounded-[24px]" />
            ))}
        </div>
    );
};

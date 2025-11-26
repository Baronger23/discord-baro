import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="h-full flex items-center justify-center bg-white dark:bg-[#313338]">
            <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-10 w-10 text-zinc-500 animate-spin" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Loading...
                </p>
            </div>
        </div>
    );
}

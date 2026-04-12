"use client";

import { MessageSquare } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { ActionTooltip } from "@/components/ui/action-tooltip";
import { cn } from "@/lib/utils";

export const NavigationDm = () => {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = pathname?.startsWith("/channels/@me");

  return (
    <ActionTooltip side="right" align="center" label="Direct Messages">
      <button title="me" onClick={() => router.push("/channels/@me")} className="group flex items-center relative">
        <div
          className={cn(
            "absolute left-0 bg-primary rounded-r-full transition-all w-[4px]",
            !isActive && "group-hover:h-[20px]",
            isActive ? "h-[36px]" : "h-[8px]"
          )}
        />
        <div
          className={cn(
            "relative group flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden items-center justify-center bg-background dark:bg-neutral-700",
            isActive && "bg-primary/10 text-primary rounded-[16px]"
          )}
        >
          <MessageSquare className={cn("h-6 w-6", isActive ? "text-primary" : "text-zinc-600 dark:text-zinc-300")} />
        </div>
      </button>
    </ActionTooltip>
  );
};

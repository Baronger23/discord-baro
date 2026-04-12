"use client";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { normalizeMediaUrl } from "@/lib/media-url";

interface NavigationItemProps {
    id: string;
    imageUrl: string;
    name: string;
}

export const NavigationItem = ({
    id,
    imageUrl,
    name
}: NavigationItemProps) => {
    const params = useParams();
    const router = useRouter();
    const safeImageUrl = normalizeMediaUrl(imageUrl);
    
    // Check if it's a dicebear SVG (external API)
    const isDicebearSvg = safeImageUrl?.includes('dicebear.com') && safeImageUrl?.includes('.svg');
    
    const onClick = () => {
        router.push(`/servers/${id}`);
    };
    return (
        <ActionTooltip
            side="right"
            align="center"
            label={name}
        >
            <button
                title="{name}"
                onClick={onClick}
                className="group flex items-center relative"
            >
                <div className={cn(
                    "absolute left-0 bg-primary rounded-r-full transition-all w-[4px]",
                    params?.serverId !== id && "group-hover:h-[20px]",
                    params?.serverId === id ? "h-[36px]" : "h-[8px]"
                )}>
                </div>
                <div className={cn(
                    "relative group flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden",
                    params?.serverId === id && "bg-primary/10 text-primary rounded-[16px]"
                )}>
                    <Image
                        fill
                        sizes="48px"
                        src={safeImageUrl}
                        alt={name}
                        unoptimized={isDicebearSvg}
                    />
                </div>
            </button>
        </ActionTooltip>
    )
};

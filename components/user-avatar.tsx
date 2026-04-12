import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/media-url";

interface UserAvatarProps {
    src?: string;
    className?: string;
};
export const UserAvatar = ({
    src,
    className
}: UserAvatarProps) => {
    const safeSrc = normalizeMediaUrl(src);

    return (
        <Avatar className={cn(
            "h-7 w-7 md:h-10 md:w-10",
            className
        )}>
            <AvatarImage src={safeSrc} />
        </Avatar>
    );
};
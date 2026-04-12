import { Menu } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

import { Button } from "@/components/ui/button";
import { NavigationSidebar } from "@/components/navigation/navigation-sidebar";
import { MeSidebar } from "@/components/channels/me-sidebar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type FriendItem = {
  friendshipId: string;
  friendProfileId: string;
  name: string;
  imageUrl: string;
  email: string;
  dmServerId: string | null;
  friendMemberId: string | null;
};

interface MeMobileToggleProps {
  friends: FriendItem[];
  incomingCount: number;
}

export const MeMobileToggle = ({ friends, incomingCount }: MeMobileToggleProps) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 flex gap-0 flex-row">
        <VisuallyHidden>
          <SheetTitle>Friends Navigation</SheetTitle>
        </VisuallyHidden>
        <div className="w-[72px]">
          <NavigationSidebar />
        </div>
        <div className="w-72">
          <MeSidebar friends={friends} incomingCount={incomingCount} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

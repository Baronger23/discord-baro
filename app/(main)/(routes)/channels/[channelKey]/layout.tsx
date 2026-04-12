import { notFound, redirect } from "next/navigation";

import { MeSidebar } from "@/components/channels/me-sidebar";
import { currentProfile } from "@/lib/current-profile";
import { getFriendDmItems, getIncomingFriendRequests } from "@/lib/friends-query";

interface ChannelKeyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ channelKey: string }>;
}

const ChannelKeyLayout = async ({ children, params }: ChannelKeyLayoutProps) => {
  const { channelKey } = await params;
  const normalizedChannelKey = decodeURIComponent(channelKey);

  if (normalizedChannelKey === "me") {
    redirect("/channels/@me");
  }

  if (normalizedChannelKey !== "@me") {
    notFound();
  }

  const profile = await currentProfile();
  if (!profile) {
    return redirect("/sign-in");
  }

  const [friends, incomingRequests] = await Promise.all([
    getFriendDmItems(profile.id),
    getIncomingFriendRequests(profile.id),
  ]);

  return (
    <div className="h-full">
      <div className="relative h-full">
        <div className="hidden md:flex h-full w-72 z-20 flex-col fixed inset-y-0">
          <MeSidebar friends={friends} incomingCount={incomingRequests.length} />
        </div>
        <main className="h-full md:pl-72 flex flex-col">{children}</main>
      </div>
    </div>
  );
};

export default ChannelKeyLayout;

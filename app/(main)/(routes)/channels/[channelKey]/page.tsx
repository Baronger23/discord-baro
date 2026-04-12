import { notFound, redirect } from "next/navigation";

import { FriendsHome } from "@/components/channels/friends-home";
import { MeMobileToggle } from "@/components/channels/me-mobile-toggle";
import { currentProfile } from "@/lib/current-profile";
import { getFriendDmItems, getIncomingFriendRequests } from "@/lib/friends-query";

interface ChannelKeyPageProps {
  params: Promise<{ channelKey: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const validTabs = new Set(["add", "requests", "dm"]);

const ChannelKeyPage = async ({ params, searchParams }: ChannelKeyPageProps) => {
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

  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams.tab && validTabs.has(resolvedSearchParams.tab)
    ? resolvedSearchParams.tab
    : "add";

  const [friends, incomingRequests] = await Promise.all([
    getFriendDmItems(profile.id),
    getIncomingFriendRequests(profile.id),
  ]);

  return (
    <div className="h-full bg-white dark:bg-[#313338] overflow-y-auto">
      <div className="h-12 border-b border-neutral-200 dark:border-neutral-800 px-3 flex items-center md:hidden">
        <MeMobileToggle friends={friends} incomingCount={incomingRequests.length} />
        <p className="font-semibold">Ban be</p>
      </div>
      <FriendsHome activeTab={tab} friends={friends} incomingRequests={incomingRequests} />
    </div>
  );
};

export default ChannelKeyPage;

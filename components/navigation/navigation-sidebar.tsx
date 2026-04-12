import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { NavigationAction } from "./navigation-action";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NavigationItem } from "./navigation-item";
import { ModeToggle } from "@/components/mode-toggle";
import { UserButton } from "@clerk/nextjs";
import { NavigationDm } from "./navigation-dm";
export const NavigationSidebar = async() => {
    const profile = await currentProfile();
    if (!profile) {
        redirect("/");
    }

    const server = await db.server.findMany({
        where: {
            isDm: false,
            members:{
                some:{
                    profileId: profile.id
                }
            }
         }
    });
    return (
        <div className="space-y-4 flex flex-col items-center h-full
        text-primary w-full dark:bg-[#121214] bg-[#E5E8EB] py-3">
            <NavigationDm />
            <Separator 
                className="h-[2px] bg-zinc-300 dark:bg-zinc-700
                rounded-md w-10 mx-auto"
            />
            <ScrollArea className="flex-1 w-full">
                {server.map((server) => (
                    <div key={server.id} className="mb-4">
                        <NavigationItem
                            id={server.id}
                            imageUrl={server.imageUrl}
                            name={server.name}
                        />
                    </div>
                ))}
                <NavigationAction />
            </ScrollArea>
            <div className="pb-3 mt-auto flex items-center flex-col gap-y-4">
                <ModeToggle />
                <UserButton 
                    afterSignOutUrl="/"
                    appearance={{
                        elements: {
                            avatarBox:"h-[48px] w-[48px]",
                        }
                    }}
                />
            </div>
        </div>
    );
}
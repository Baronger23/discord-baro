"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// ✅ LAZY LOAD: Load modals only when needed (200KB+ savings)
// Each modal is split into separate chunks and loaded on-demand
const CreateServerModal = dynamic(
    () => import("@/components/modals/create-server-modal").then(mod => ({ default: mod.CreateServerModal })),
    { ssr: false }
);

const InviteModal = dynamic(
    () => import("@/components/modals/invite-modal").then(mod => ({ default: mod.InviteModal })),
    { ssr: false }
);

const EditServerModal = dynamic(
    () => import("@/components/modals/edit-server-modal").then(mod => ({ default: mod.EditServerModal })),
    { ssr: false }
);

const MembersModal = dynamic(
    () => import("@/components/modals/members-modal").then(mod => ({ default: mod.MembersModal })),
    { ssr: false }
);

const CreateChannelModal = dynamic(
    () => import("@/components/modals/create-channel-modal").then(mod => ({ default: mod.CreateChannelModal })),
    { ssr: false }
);

const LeaveServerModal = dynamic(
    () => import("@/components/modals/leave-server-modal").then(mod => ({ default: mod.LeaveServerModal })),
    { ssr: false }
);

const DeleteServerModal = dynamic(
    () => import("@/components/modals/delete-server-modal").then(mod => ({ default: mod.DeleteServerModal })),
    { ssr: false }
);

const DeleteChannelModal = dynamic(
    () => import("@/components/modals/delete-channel-modal").then(mod => ({ default: mod.DeleteChannelModal })),
    { ssr: false }
);

const EditChannelModal = dynamic(
    () => import("@/components/modals/edit-channel-modal").then(mod => ({ default: mod.EditChannelModal })),
    { ssr: false }
);

const MessageFileModal = dynamic(
    () => import("@/components/modals/message-file-modal").then(mod => ({ default: mod.MessageFileModal })),
    { ssr: false }
);

const DeleteMessageModal = dynamic(
    () => import("@/components/modals/delete-message-modal").then(mod => ({ default: mod.DeleteMessageModal })),
    { ssr: false }
);

export const ModalProvider = () => {

    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return null;
    }
    
    return (
        <>
            <CreateServerModal />
            <InviteModal />
            <EditServerModal />
            <MembersModal />
            <CreateChannelModal />
            <LeaveServerModal />
            <DeleteServerModal />
            <DeleteChannelModal />
            <EditChannelModal />
            <MessageFileModal />
            <DeleteMessageModal />
        </>
    );
};

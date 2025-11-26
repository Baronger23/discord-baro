"use client";
import axios from "axios";
import { useState, useEffect } from "react";
import { MemberRole } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Shield, ShieldCheck, ShieldAlert, Lock, Unlock, Loader2, UserPlus, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ServerMember {
  id: string;
  role: MemberRole;
  profileId: string;
  profile: {
    id: string;
    name: string;
    imageUrl: string;
  };
}

interface ChannelPermissionData {
  channelId: string;
  isPrivate: boolean;
  allowedRoles: MemberRole[];
  permissions: Array<{
    id: string;
    memberId: string;
    memberName: string;
    canView: boolean;
    canSendMessages: boolean;
    canManageMessages: boolean;
    canInviteMembers: boolean;
  }>;
}

export const ManageChannelPermissionsModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const router = useRouter();

  const isModalOpen = isOpen && type === "manageChannelPermissions";
  const { channel, server } = data;

  const [loading, setLoading] = useState(false);
  const [permissionData, setPermissionData] = useState<ChannelPermissionData | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<MemberRole[]>([
    MemberRole.ADMIN,
    MemberRole.MODERATOR,
    MemberRole.GUEST,
  ]);
  const [serverMembers, setServerMembers] = useState<ServerMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");

  useEffect(() => {
    if (isModalOpen && channel && server) {
      fetchPermissions();
      fetchServerMembers();
    }
  }, [isModalOpen, channel, server]);

  const fetchServerMembers = async () => {
    if (!server) return;

    try {
      const response = await axios.get(`/api/servers/${server.id}/members`);
      setServerMembers(response.data);
    } catch (error) {
      console.error("Failed to fetch server members:", error);
    }
  };

  const fetchPermissions = async () => {
    if (!channel) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/channels/${channel.id}/permissions`);
      const data = response.data;
      
      setPermissionData(data);
      setIsPrivate(data.isPrivate);
      setAllowedRoles(data.allowedRoles);
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChannelSettings = async () => {
    if (!channel) return;

    try {
      setLoading(true);
      await axios.patch(`/api/channels/${channel.id}/permissions`, {
        isPrivate,
        allowedRoles,
      });

      router.refresh();
      await fetchPermissions();
    } catch (error) {
      console.error("Failed to update channel settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = (role: MemberRole) => {
    if (role === MemberRole.ADMIN) return; // ADMIN always has access

    setAllowedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleGrantAccess = async (memberId: string) => {
    if (!channel || !memberId) return;

    try {
      setLoading(true);
      await axios.post(`/api/channels/${channel.id}/permissions`, {
        memberId,
        canView: true,
        canSendMessages: true,
        canManageMessages: false,
        canInviteMembers: false,
      });

      setSelectedMemberId(""); // Reset selection
      await fetchPermissions();
    } catch (error) {
      console.error("Failed to grant access:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (memberId: string) => {
    if (!channel) return;

    try {
      setLoading(true);
      await axios.delete(`/api/channels/${channel.id}/permissions?memberId=${memberId}`);
      await fetchPermissions();
    } catch (error) {
      console.error("Failed to revoke access:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPermissionData(null);
    onClose();
  };

  const roleIconMap = {
    [MemberRole.GUEST]: <Shield className="h-4 w-4 text-gray-500" />,
    [MemberRole.MODERATOR]: <ShieldCheck className="h-4 w-4 text-indigo-500" />,
    [MemberRole.ADMIN]: <ShieldAlert className="h-4 w-4 text-rose-500" />,
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden max-w-2xl">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            Manage Channel Permissions
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">
            Configure access control for #{channel?.name}
          </DialogDescription>
        </DialogHeader>

        {loading && !permissionData ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : (
          <ScrollArea className="max-h-[500px] px-6 pb-6">
            {/* Channel Settings */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-2">
                  {isPrivate ? (
                    <Lock className="h-5 w-5 text-red-500" />
                  ) : (
                    <Unlock className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <Label className="text-sm font-semibold">Private Channel</Label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {isPrivate
                        ? "Only members with explicit permission can access"
                        : "Access controlled by role permissions"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  disabled={loading}
                />
              </div>

              {!isPrivate && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Allowed Roles</Label>
                  <div className="space-y-2">
                    {Object.values(MemberRole).map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={allowedRoles.includes(role)}
                          onCheckedChange={() => handleToggleRole(role)}
                          disabled={loading || role === MemberRole.ADMIN}
                        />
                        <Label
                          htmlFor={`role-${role}`}
                          className="flex items-center gap-x-2 text-sm cursor-pointer"
                        >
                          {roleIconMap[role]}
                          <span>{role}</span>
                          {role === MemberRole.ADMIN && (
                            <span className="text-xs text-zinc-500">(Always has access)</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleSaveChannelSettings}
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Channel Settings
              </Button>
            </div>

            <Separator className="my-4" />

            {/* Member-Specific Permissions (for private channels) */}
            {isPrivate && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Member Permissions</Label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Grant or revoke access to specific members
                  </p>
                </div>

                {/* Add Member Section */}
                <div className="flex gap-x-2">
                  <Select
                    value={selectedMemberId}
                    onValueChange={setSelectedMemberId}
                    disabled={loading}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a member to invite..." />
                    </SelectTrigger>
                    <SelectContent>
                      {serverMembers
                        .filter((member) => 
                          // Filter out members who already have access
                          !permissionData?.permissions.some(p => p.memberId === member.id) &&
                          // Filter out ADMINs (they always have access)
                          member.role !== MemberRole.ADMIN
                        )
                        .map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-x-2">
                              {roleIconMap[member.role]}
                              <span>{member.profile.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      {serverMembers.filter((member) => 
                        !permissionData?.permissions.some(p => p.memberId === member.id) &&
                        member.role !== MemberRole.ADMIN
                      ).length === 0 && (
                        <SelectItem value="no-members" disabled>
                          No members available to invite
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => handleGrantAccess(selectedMemberId)}
                    disabled={loading || !selectedMemberId}
                    size="icon"
                    className="flex-shrink-0"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Member List */}
                {permissionData?.permissions && permissionData.permissions.length > 0 ? (
                  <div className="space-y-2">
                    {permissionData.permissions.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-3 rounded-md bg-zinc-100 dark:bg-zinc-800"
                      >
                        <div className="flex items-center gap-x-2">
                          <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
                            {perm.memberName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{perm.memberName}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-x-1">
                              <Check className="h-3 w-3 text-green-500" />
                              {perm.canManageMessages
                                ? "Can manage messages"
                                : perm.canSendMessages
                                ? "Can send messages"
                                : "View only"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeAccess(perm.memberId)}
                          disabled={loading}
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                    No members have been granted access yet
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        )}

        <DialogFooter className="bg-gray-100 dark:bg-[#2b2d31] px-6 py-4">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

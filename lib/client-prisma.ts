export const MEMBER_ROLE = {
  ADMIN: "ADMIN",
  MODERATOR: "MODERATOR",
  GUEST: "GUEST",
} as const;

export const MEMBER_ROLES = [
  MEMBER_ROLE.ADMIN,
  MEMBER_ROLE.MODERATOR,
  MEMBER_ROLE.GUEST,
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export const CHANNEL_TYPE = {
  TEXT: "TEXT",
  AUDIO: "AUDIO",
  VIDEO: "VIDEO",
  WHITEBOARD: "WHITEBOARD",
} as const;

export const CHANNEL_TYPES = [
  CHANNEL_TYPE.TEXT,
  CHANNEL_TYPE.AUDIO,
  CHANNEL_TYPE.VIDEO,
  CHANNEL_TYPE.WHITEBOARD,
] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

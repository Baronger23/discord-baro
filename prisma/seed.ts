import { PrismaClient, MemberRole, ChannelType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Xóa data cũ (nếu có)
  console.log('🧹 Cleaning up old data...');
  await prisma.directMessage.deleteMany();
  await prisma.message.deleteMany();
  await prisma.whiteboardDrawCommand.deleteMany();
  await prisma.whiteboardState.deleteMany();
  await prisma.channelPermission.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.member.deleteMany();
  await prisma.server.deleteMany();
  await prisma.profile.deleteMany();
  console.log('✅ Cleanup complete\n');

  // 1. Tạo Profiles (Users)
  console.log('👤 Creating profiles...');
  const profile1 = await prisma.profile.create({
    data: {
      userId: 'user_seed_001',
      name: 'Anh Bảo Nguyễn Phan',
      email: 'bao@example.com',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bao',
    }
  });

  const profile2 = await prisma.profile.create({
    data: {
      userId: 'user_seed_002',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    }
  });

  const profile3 = await prisma.profile.create({
    data: {
      userId: 'user_seed_003',
      name: 'Bob Smith',
      email: 'bob@example.com',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    }
  });

  const profile4 = await prisma.profile.create({
    data: {
      userId: 'user_seed_004',
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
    }
  });

  console.log(`✅ Created ${4} profiles\n`);

  // 2. Tạo Server
  console.log('🖥️  Creating servers...');
  const server1 = await prisma.server.create({
    data: {
      name: 'PBL4 Development Team',
      imageUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=PBL4',
      inviteCode: 'PBL4-DEV-2025',
      profileId: profile1.id,
    }
  });

  const server2 = await prisma.server.create({
    data: {
      name: 'Discord Clone Testing',
      imageUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=Discord',
      inviteCode: 'DISCORD-TEST',
      profileId: profile2.id,
    }
  });

  console.log(`✅ Created ${2} servers\n`);

  // 3. Tạo Members
  console.log('👥 Creating members...');
  
  // Server 1 members
  const member1_1 = await prisma.member.create({
    data: {
      role: MemberRole.ADMIN,
      profileId: profile1.id,
      serverId: server1.id,
    }
  });

  const member1_2 = await prisma.member.create({
    data: {
      role: MemberRole.MODERATOR,
      profileId: profile2.id,
      serverId: server1.id,
    }
  });

  const member1_3 = await prisma.member.create({
    data: {
      role: MemberRole.GUEST,
      profileId: profile3.id,
      serverId: server1.id,
    }
  });

  const member1_4 = await prisma.member.create({
    data: {
      role: MemberRole.GUEST,
      profileId: profile4.id,
      serverId: server1.id,
    }
  });

  // Server 2 members
  const member2_1 = await prisma.member.create({
    data: {
      role: MemberRole.ADMIN,
      profileId: profile2.id,
      serverId: server2.id,
    }
  });

  const member2_2 = await prisma.member.create({
    data: {
      role: MemberRole.GUEST,
      profileId: profile1.id,
      serverId: server2.id,
    }
  });

  const member2_3 = await prisma.member.create({
    data: {
      role: MemberRole.GUEST,
      profileId: profile3.id,
      serverId: server2.id,
    }
  });

  console.log(`✅ Created ${7} members\n`);

  // 4. Tạo Channels
  console.log('📢 Creating channels...');
  
  // Server 1 channels
  const channelGeneral = await prisma.channel.create({
    data: {
      name: 'general',
      type: ChannelType.TEXT,
      profileId: profile1.id,
      serverId: server1.id,
    }
  });

  const channelAnnouncements = await prisma.channel.create({
    data: {
      name: 'announcements',
      type: ChannelType.TEXT,
      profileId: profile1.id,
      serverId: server1.id,
      isPrivate: false,
      allowedRoles: [MemberRole.ADMIN, MemberRole.MODERATOR, MemberRole.GUEST],
    }
  });

  const channelVoiceGeneral = await prisma.channel.create({
    data: {
      name: 'Voice General',
      type: ChannelType.AUDIO,
      profileId: profile1.id,
      serverId: server1.id,
    }
  });

  const channelVideoMeeting = await prisma.channel.create({
    data: {
      name: 'Video Meeting',
      type: ChannelType.VIDEO,
      profileId: profile1.id,
      serverId: server1.id,
    }
  });

  const channelWhiteboard = await prisma.channel.create({
    data: {
      name: 'Project Whiteboard',
      type: ChannelType.WHITEBOARD,
      profileId: profile1.id,
      serverId: server1.id,
    }
  });

  const channelPrivate = await prisma.channel.create({
    data: {
      name: 'admin-only',
      type: ChannelType.TEXT,
      profileId: profile1.id,
      serverId: server1.id,
      isPrivate: true,
      allowedRoles: [MemberRole.ADMIN, MemberRole.MODERATOR],
    }
  });

  // Server 2 channels
  const channel2General = await prisma.channel.create({
    data: {
      name: 'general',
      type: ChannelType.TEXT,
      profileId: profile2.id,
      serverId: server2.id,
    }
  });

  const channel2Testing = await prisma.channel.create({
    data: {
      name: 'testing-webrtc',
      type: ChannelType.VIDEO,
      profileId: profile2.id,
      serverId: server2.id,
    }
  });

  console.log(`✅ Created ${8} channels\n`);

  // 5. Tạo Messages
  console.log('💬 Creating messages...');
  
  const messages = await prisma.message.createMany({
    data: [
      {
        content: 'Chào mọi người! Welcome to PBL4 Development Team 🎉',
        memberId: member1_1.id,
        channelId: channelGeneral.id,
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: member1_1.id,
      },
      {
        content: 'Dự án Discord Clone của chúng ta sẽ có những features: Text Chat, Voice, Video Call, và Whiteboard!',
        memberId: member1_1.id,
        channelId: channelGeneral.id,
      },
      {
        content: 'Sounds great! Khi nào test WebRTC?',
        memberId: member1_2.id,
        channelId: channelGeneral.id,
      },
      {
        content: 'Mình đã implement custom WebRTC rồi, có thể test ngay!',
        memberId: member1_1.id,
        channelId: channelGeneral.id,
      },
      {
        content: 'Let me join the video call to test!',
        memberId: member1_3.id,
        channelId: channelGeneral.id,
      },
      {
        content: '📌 IMPORTANT: Please check the Video Meeting channel for today\'s standup at 2 PM',
        memberId: member1_1.id,
        channelId: channelAnnouncements.id,
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: member1_1.id,
      },
      {
        content: 'Meeting agenda: 1. WebRTC progress 2. Database optimization 3. UI/UX improvements',
        memberId: member1_2.id,
        channelId: channelAnnouncements.id,
      },
      {
        content: 'Admin discussion: How should we handle private channels?',
        memberId: member1_1.id,
        channelId: channelPrivate.id,
      },
      {
        content: 'I think we should use the ChannelPermission model for fine-grained access control',
        memberId: member1_2.id,
        channelId: channelPrivate.id,
      },
      {
        content: 'Hello from server 2!',
        memberId: member2_1.id,
        channelId: channel2General.id,
      },
      {
        content: 'Testing WebRTC implementation here',
        memberId: member2_2.id,
        channelId: channel2Testing.id,
      },
    ]
  });

  console.log(`✅ Created ${messages.count} messages\n`);

  // 6. Tạo Conversations (Direct Messages)
  console.log('💬 Creating conversations...');
  
  const conversation1 = await prisma.conversation.create({
    data: {
      memberOneId: member1_1.id,
      memberTwoId: member1_2.id,
    }
  });

  const conversation2 = await prisma.conversation.create({
    data: {
      memberOneId: member1_1.id,
      memberTwoId: member1_3.id,
    }
  });

  console.log(`✅ Created ${2} conversations\n`);

  // 7. Tạo Direct Messages
  console.log('💌 Creating direct messages...');
  
  await prisma.directMessage.createMany({
    data: [
      {
        content: 'Hey Alice, can you review my WebRTC code?',
        memberId: member1_1.id,
        conversationId: conversation1.id,
      },
      {
        content: 'Sure! Send me the link to the PR',
        memberId: member1_2.id,
        conversationId: conversation1.id,
      },
      {
        content: 'Here: github.com/Baronger23/discord-baro/pull/123',
        memberId: member1_1.id,
        conversationId: conversation1.id,
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: member1_1.id,
      },
      {
        content: 'Hi Bob! Có free không? Cần help test video call',
        memberId: member1_1.id,
        conversationId: conversation2.id,
      },
      {
        content: 'Sure, I\'m available now!',
        memberId: member1_3.id,
        conversationId: conversation2.id,
      },
    ]
  });

  console.log(`✅ Created direct messages\n`);

  // 8. Tạo Whiteboard State
  console.log('🎨 Creating whiteboard state...');
  
  await prisma.whiteboardState.create({
    data: {
      channelId: channelWhiteboard.id,
      drawingData: JSON.stringify([
        { type: 'draw', points: [[100, 100], [200, 200]], color: '#000000', width: 2 },
        { type: 'draw', points: [[300, 150], [400, 150]], color: '#FF0000', width: 3 },
      ]),
      lastEditBy: profile1.id,
      lastEditAt: new Date(),
      version: 1,
    }
  });

  console.log(`✅ Created whiteboard state\n`);

  // 9. Tạo Whiteboard Draw Commands
  console.log('✏️  Creating whiteboard draw commands...');
  
  await prisma.whiteboardDrawCommand.createMany({
    data: [
      {
        channelId: channelWhiteboard.id,
        commandType: 'draw',
        data: JSON.stringify({ points: [[100, 100], [200, 200]], color: '#000000', width: 2 }),
        sequence: 1,
        profileId: profile1.id,
        memberId: member1_1.id,
      },
      {
        channelId: channelWhiteboard.id,
        commandType: 'draw',
        data: JSON.stringify({ points: [[300, 150], [400, 150]], color: '#FF0000', width: 3 }),
        sequence: 2,
        profileId: profile2.id,
        memberId: member1_2.id,
      },
    ]
  });

  console.log(`✅ Created whiteboard draw commands\n`);

  // 10. Tạo Channel Permissions
  console.log('🔐 Creating channel permissions...');
  
  await prisma.channelPermission.createMany({
    data: [
      {
        channelId: channelPrivate.id,
        memberId: member1_1.id,
        canView: true,
        canSendMessages: true,
        canManageMessages: true,
        canInviteMembers: true,
      },
      {
        channelId: channelPrivate.id,
        memberId: member1_2.id,
        canView: true,
        canSendMessages: true,
        canManageMessages: true,
        canInviteMembers: false,
      },
    ]
  });

  console.log(`✅ Created channel permissions\n`);

  // Summary
  console.log('📊 SEED SUMMARY:');
  console.log('==================');
  console.log(`✅ Profiles: 4`);
  console.log(`✅ Servers: 2`);
  console.log(`   - ${server1.name} (Invite: ${server1.inviteCode})`);
  console.log(`   - ${server2.name} (Invite: ${server2.inviteCode})`);
  console.log(`✅ Members: 7`);
  console.log(`✅ Channels: 8`);
  console.log(`   - TEXT: 4`);
  console.log(`   - AUDIO: 1`);
  console.log(`   - VIDEO: 2`);
  console.log(`   - WHITEBOARD: 1`);
  console.log(`✅ Messages: ${messages.count} (2 pinned)`);
  console.log(`✅ Conversations: 2`);
  console.log(`✅ Direct Messages: 5 (1 pinned)`);
  console.log(`✅ Whiteboard: 1 state + 2 commands`);
  console.log(`✅ Channel Permissions: 2`);
  console.log('==================\n');
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

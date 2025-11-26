/**
 * Database Seeding Script
 * Tạo dữ liệu mẫu để test benchmark
 */

import { db } from "@/lib/db";
import { MemberRole, ChannelType } from "@prisma/client";

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // 1. Tạo Profile
    console.log('Creating profiles...');
    const profile1 = await db.profile.create({
      data: {
        userId: 'user_test_1',
        name: 'Test User 1',
        email: 'user1@test.com',
        imageUrl: 'https://example.com/avatar1.jpg'
      }
    });

    const profile2 = await db.profile.create({
      data: {
        userId: 'user_test_2',
        name: 'Test User 2',
        email: 'user2@test.com',
        imageUrl: 'https://example.com/avatar2.jpg'
      }
    });

    const profile3 = await db.profile.create({
      data: {
        userId: 'user_test_3',
        name: 'Test User 3',
        email: 'user3@test.com',
        imageUrl: 'https://example.com/avatar3.jpg'
      }
    });

    console.log(`✅ Created ${3} profiles`);

    // 2. Tạo Server
    console.log('\nCreating server...');
    const server = await db.server.create({
      data: {
        name: 'Test Server',
        imageUrl: 'https://example.com/server.jpg',
        inviteCode: 'TEST123',
        profileId: profile1.id
      }
    });
    console.log(`✅ Created server: ${server.name}`);

    // 3. Tạo Members
    console.log('\nCreating members...');
    const member1 = await db.member.create({
      data: {
        role: MemberRole.ADMIN,
        profileId: profile1.id,
        serverId: server.id
      }
    });

    const member2 = await db.member.create({
      data: {
        role: MemberRole.MODERATOR,
        profileId: profile2.id,
        serverId: server.id
      }
    });

    const member3 = await db.member.create({
      data: {
        role: MemberRole.GUEST,
        profileId: profile3.id,
        serverId: server.id
      }
    });

    console.log(`✅ Created ${3} members`);

    // 4. Tạo Channels
    console.log('\nCreating channels...');
    const channelGeneral = await db.channel.create({
      data: {
        name: 'general',
        type: ChannelType.TEXT,
        profileId: profile1.id,
        serverId: server.id,
        isPrivate: false
      }
    });

    const channelPrivate = await db.channel.create({
      data: {
        name: 'private-channel',
        type: ChannelType.TEXT,
        profileId: profile1.id,
        serverId: server.id,
        isPrivate: true,
        allowedRoles: [MemberRole.ADMIN, MemberRole.MODERATOR]
      }
    });

    const channelVoice = await db.channel.create({
      data: {
        name: 'voice-chat',
        type: ChannelType.AUDIO,
        profileId: profile1.id,
        serverId: server.id,
        isPrivate: false
      }
    });

    console.log(`✅ Created ${3} channels`);

    // 5. Tạo Channel Permissions
    console.log('\nCreating channel permissions...');
    await db.channelPermission.create({
      data: {
        channelId: channelPrivate.id,
        memberId: member2.id,
        canView: true,
        canSendMessages: true,
        canManageMessages: false,
        canInviteMembers: false
      }
    });

    await db.channelPermission.create({
      data: {
        channelId: channelPrivate.id,
        memberId: member3.id,
        canView: false,
        canSendMessages: false,
        canManageMessages: false,
        canInviteMembers: false
      }
    });

    console.log(`✅ Created channel permissions`);

    // 6. Tạo Messages
    console.log('\nCreating messages...');
    const messagePromises = [];
    for (let i = 1; i <= 100; i++) {
      messagePromises.push(
        db.message.create({
          data: {
            content: `Test message ${i} in general channel`,
            memberId: [member1.id, member2.id, member3.id][i % 3],
            channelId: channelGeneral.id,
            deleted: i % 10 === 0 // 10% messages deleted
          }
        })
      );
    }
    await Promise.all(messagePromises);
    console.log(`✅ Created ${100} messages`);

    // 7. Tạo Conversation
    console.log('\nCreating conversation...');
    const conversation = await db.conversation.create({
      data: {
        memberOneId: member1.id,
        memberTwoId: member2.id
      }
    });
    console.log(`✅ Created conversation`);

    // 8. Tạo Direct Messages
    console.log('\nCreating direct messages...');
    const dmPromises = [];
    for (let i = 1; i <= 50; i++) {
      dmPromises.push(
        db.directMessage.create({
          data: {
            content: `Direct message ${i}`,
            memberId: i % 2 === 0 ? member1.id : member2.id,
            conversationId: conversation.id,
            deleted: i % 15 === 0
          }
        })
      );
    }
    await Promise.all(dmPromises);
    console.log(`✅ Created ${50} direct messages`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Database seeded successfully!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`  - Profiles: 3`);
    console.log(`  - Servers: 1`);
    console.log(`  - Members: 3`);
    console.log(`  - Channels: 3 (1 private)`);
    console.log(`  - Messages: 100`);
    console.log(`  - Conversations: 1`);
    console.log(`  - Direct Messages: 50`);
    console.log(`  - Channel Permissions: 2`);
    console.log('\n✅ Ready to run benchmarks!\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

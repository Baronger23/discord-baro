/**
 * Seed Data for Specific User
 * Tạo server mới cho user với ID cụ thể
 * - 1 server
 * - 2 text channels
 * - 150 messages per channel
 */

import { db } from "@/lib/db";
import { MemberRole, ChannelType } from "@prisma/client";

const USER_PROFILE_ID = "69cc7b86-a013-4783-9f35-30b0dc3ac640";

async function seedSpecificUser() {
  console.log('🌱 Seeding data for specific user...\n');
  console.log(`Profile ID: ${USER_PROFILE_ID}\n`);

  try {
    // 1. Kiểm tra profile có tồn tại không
    console.log('Checking if profile exists...');
    const profile = await db.profile.findUnique({
      where: { id: USER_PROFILE_ID }
    });

    if (!profile) {
      console.log('❌ Profile not found!');
      console.log('Please make sure the profile ID is correct.');
      return;
    }

    console.log(`✅ Found profile: ${profile.name} (${profile.email})`);

    // 2. Tạo Server mới
    console.log('\nCreating new server...');
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const server = await db.server.create({
      data: {
        name: 'Performance Test Server',
        imageUrl: 'https://utfs.io/f/default-server.png',
        inviteCode: inviteCode,
        profileId: profile.id
      }
    });
    console.log(`✅ Created server: ${server.name} (Invite: ${inviteCode})`);

    // 3. Tạo Member (Admin) cho profile này
    console.log('\nCreating member...');
    const member = await db.member.create({
      data: {
        role: MemberRole.ADMIN,
        profileId: profile.id,
        serverId: server.id
      }
    });
    console.log(`✅ Created admin member`);

    // 4. Tạo 2 Text Channels
    console.log('\nCreating text channels...');
    const channel1 = await db.channel.create({
      data: {
        name: 'general',
        type: ChannelType.TEXT,
        profileId: profile.id,
        serverId: server.id,
        isPrivate: false
      }
    });
    console.log(`✅ Created channel: ${channel1.name}`);

    const channel2 = await db.channel.create({
      data: {
        name: 'random',
        type: ChannelType.TEXT,
        profileId: profile.id,
        serverId: server.id,
        isPrivate: false
      }
    });
    console.log(`✅ Created channel: ${channel2.name}`);

    // 5. Tạo 150 messages cho mỗi channel
    console.log('\nCreating messages for channels...');
    console.log('This may take a moment...\n');

    // Channel 1 - General (150 messages) - Sequential creation
    console.log(`Creating 150 messages for #${channel1.name}...`);
    for (let i = 1; i <= 150; i++) {
      await db.message.create({
        data: {
          content: `Message ${i} in #general channel. This is test content for performance testing.`,
          memberId: member.id,
          channelId: channel1.id,
          deleted: false
        }
      });

      // Log progress every 50 messages
      if (i % 50 === 0) {
        console.log(`  Progress: ${i}/150 messages`);
      }
    }
    console.log(`✅ Created 150 messages in #${channel1.name}`);

    // Channel 2 - Random (150 messages) - Sequential creation
    console.log(`\nCreating 150 messages for #${channel2.name}...`);
    for (let i = 1; i <= 150; i++) {
      await db.message.create({
        data: {
          content: `Message ${i} in #random channel. Random content for testing purposes.`,
          memberId: member.id,
          channelId: channel2.id,
          deleted: false
        }
      });

      // Log progress every 50 messages
      if (i % 50 === 0) {
        console.log(`  Progress: ${i}/150 messages`);
      }
    }
    console.log(`✅ Created 150 messages in #${channel2.name}`);

    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Seeding completed successfully!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`  Profile: ${profile.name}`);
    console.log(`  Profile ID: ${profile.id}`);
    console.log(`  Server: ${server.name}`);
    console.log(`  Server ID: ${server.id}`);
    console.log(`  Invite Code: ${inviteCode}`);
    console.log(`  Channels: 2`);
    console.log(`    - #${channel1.name} (${channel1.id})`);
    console.log(`    - #${channel2.name} (${channel2.id})`);
    console.log(`  Total Messages: 300 (150 per channel)`);
    console.log(`  Member Role: ${member.role}`);
    console.log('\n🎉 Data ready for testing!\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run seeding
seedSpecificUser()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

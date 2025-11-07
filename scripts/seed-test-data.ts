/**
 * 🌱 SEED SCRIPT: Create Test Server with 100+ Messages
 * 
 * Usage: npm run db:seed [userId] [userName] [userEmail]
 * 
 * Examples:
 *   npm run db:seed user_123abc "John Doe" john@example.com
 *   npm run db:seed user_123abc
 * 
 * This script will:
 * 1. Create or find a profile with the provided userId
 * 2. Create a test server with invite code
 * 3. Create a "general" text channel
 * 4. Generate 150 test messages in the channel
 * 5. Print server invite link
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Sample messages for more realistic data
const SAMPLE_MESSAGES = [
  "Hey everyone! 👋",
  "How's it going?",
  "Anyone up for a game later?",
  "Just finished a great project!",
  "What are you all working on?",
  "This is awesome! 🎉",
  "Has anyone seen the new update?",
  "I'm working on something cool",
  "Need some help with coding",
  "Thanks for the support!",
  "Let's chat about this",
  "Great idea!",
  "I agree with that",
  "Interesting perspective",
  "What do you think?",
  "Can someone help me?",
  "This is confusing",
  "I found a solution!",
  "Check this out",
  "Pretty cool stuff",
  "Anyone online?",
  "Good morning! ☀️",
  "Good night! 🌙",
  "See you later!",
  "Be right back",
  "I'm back!",
  "LOL that's funny 😂",
  "Makes sense",
  "Not sure about that",
  "Let me think...",
  "Probably yes",
  "Definitely not",
  "Maybe tomorrow?",
  "Sounds good to me",
  "I'm down for that",
  "Count me in!",
  "Sorry, can't make it",
  "Next time for sure",
  "What time works?",
  "Anytime is fine",
  "Weekend sounds better",
];

async function main() {
  console.log("\n🌱 Starting seed script...\n");

  try {
    // Get userId from command line arguments
    const userId = process.argv[2];
    const userName = process.argv[3] || "Test User";
    const userEmail = process.argv[4] || "test@example.com";

    if (!userId) {
      console.error("❌ No userId provided!");
      console.log("\n📋 Usage:");
      console.log("   npm run db:seed <userId> [userName] [userEmail]");
      console.log("\n💡 How to get your userId:");
      console.log("   1. Go to your Clerk Dashboard");
      console.log("   2. Open 'Users' section");
      console.log("   3. Click on your user");
      console.log("   4. Copy the User ID (starts with 'user_')");
      console.log("\n📝 Example:");
      console.log('   npm run db:seed user_2abc123xyz "John Doe" john@example.com\n');
      process.exit(1);
    }

    console.log("📝 Using userId:", userId);
    
    // Create or find profile
    let profile = await db.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      console.log("➕ Creating new profile...");
      profile = await db.profile.create({
        data: {
          userId,
          name: userName,
          email: userEmail,
          imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        },
      });
      console.log(`✅ Profile created: ${profile.name}`);
    } else {
      console.log(`✅ Found existing profile: ${profile.name} (${profile.email})`);
    }

    // Generate unique invite code
    const inviteCode = `TEST-${Date.now().toString(36).toUpperCase()}`;

    // Create server
    console.log("\n📦 Creating test server...");
    const server = await db.server.create({
      data: {
        name: "Test Server - Performance Testing",
        imageUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=test-server",
        inviteCode,
        profileId: profile.id,
      },
    });
    console.log(`✅ Server created: ${server.name}`);
    console.log(`   ID: ${server.id}`);
    console.log(`   Invite Code: ${inviteCode}`);

    // Create member (owner)
    console.log("\n👤 Creating member...");
    const member = await db.member.create({
      data: {
        role: "ADMIN",
        profileId: profile.id,
        serverId: server.id,
      },
    });
    console.log(`✅ Member created (ADMIN)`);

    // Create general channel
    console.log("\n📢 Creating text channel...");
    const channel = await db.channel.create({
      data: {
        name: "general",
        type: "TEXT",
        profileId: profile.id,
        serverId: server.id,
      },
    });
    console.log(`✅ Channel created: #${channel.name}`);
    console.log(`   ID: ${channel.id}`);

    // Generate 150 messages
    console.log("\n💬 Generating 150 test messages...");
    const MESSAGE_COUNT = 150;
    const messages = [];

    for (let i = 1; i <= MESSAGE_COUNT; i++) {
      // Pick random message from samples
      const content =
        i === 1
          ? "🎉 Welcome to the test server! This channel has 150 messages to test pagination."
          : i === MESSAGE_COUNT
          ? "🏁 This is the last message (#150). Scroll up to see all messages!"
          : `${SAMPLE_MESSAGES[i % SAMPLE_MESSAGES.length]} (Message #${i})`;

      messages.push({
        content,
        memberId: member.id,
        channelId: channel.id,
        // Stagger creation times (1 second apart for realistic timeline)
        createdAt: new Date(Date.now() - (MESSAGE_COUNT - i) * 1000),
      });

      // Log progress every 25 messages
      if (i % 25 === 0) {
        console.log(`   Progress: ${i}/${MESSAGE_COUNT} messages...`);
      }
    }

    // Batch insert messages for performance
    await db.message.createMany({
      data: messages,
    });

    console.log(`✅ Created ${MESSAGE_COUNT} messages successfully!`);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n📊 Summary:");
    console.log(`   Server: ${server.name}`);
    console.log(`   Channel: #${channel.name}`);
    console.log(`   Messages: ${MESSAGE_COUNT}`);
    console.log(`   Owner: ${profile.name}`);
    console.log("\n🔗 Invite Link:");
    console.log(`   http://localhost:3000/invite/${inviteCode}`);
    console.log("\n📌 Test Instructions:");
    console.log("   1. Open the app: http://localhost:3000");
    console.log("   2. Navigate to the server");
    console.log("   3. Open #general channel");
    console.log("   4. Scroll up to test pagination!");
    console.log("   5. Watch as messages load in batches of 50");
    console.log("\n⚡ Performance Testing:");
    console.log("   - Initial load: Should show last 50 messages");
    console.log("   - Scroll to top: Should trigger pagination");
    console.log("   - Load time: Should be <100ms per batch");
    console.log("   - Memory: Should stay under 50MB");
    console.log("\n✅ With indexes: Queries will be super fast!");
    console.log("   Run: npx prisma migrate dev --name add_pagination_indexes");
    console.log("");

  } catch (error) {
    console.error("\n❌ Error during seeding:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the seed script
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

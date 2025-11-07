/**
 * 🔍 GET USER ID: Helper script to find your Clerk userId
 * 
 * Usage: npm run get-user-id
 * 
 * This will list all users in the database with their IDs
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("\n🔍 Fetching all profiles from database...\n");

  try {
    const profiles = await db.profile.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (profiles.length === 0) {
      console.log("❌ No profiles found in database.");
      console.log("\n💡 Steps to get userId:");
      console.log("   1. Make sure your app is running: npm run dev");
      console.log("   2. Log in through the web interface: http://localhost:3000");
      console.log("   3. A profile will be created automatically");
      console.log("   4. Run this script again: npm run get-user-id\n");
      console.log("   OR go to Clerk Dashboard → Users → Copy User ID\n");
      process.exit(0);
    }

    console.log(`✅ Found ${profiles.length} profile(s):\n`);
    console.log("═".repeat(80));

    profiles.forEach((profile, index) => {
      console.log(`\n[${index + 1}] ${profile.name}`);
      console.log(`    User ID: ${profile.userId}`);
      console.log(`    Email:   ${profile.email}`);
      console.log(`    Created: ${profile.createdAt.toLocaleDateString()}`);
    });

    console.log("\n" + "═".repeat(80));
    console.log("\n📝 To create test data, copy a User ID and run:");
    console.log(`   npm run db:seed ${profiles[0].userId}`);
    console.log("\n   Or with custom name:");
    console.log(`   npm run db:seed ${profiles[0].userId} "Your Name" your@email.com\n`);

  } catch (error) {
    console.error("\n❌ Error fetching profiles:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();

/**
 * Database Performance Benchmark Utility
 * 
 * Chạy script này để test performance của các queries quan trọng
 * 
 * Usage:
 * npx ts-node scripts/benchmark-db.ts
 */

import { db } from "@/lib/db";

interface BenchmarkResult {
  name: string;
  iterations: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  totalTime: number;
}

async function benchmark(
  name: string, 
  fn: () => Promise<any>, 
  iterations: number = 10
): Promise<BenchmarkResult> {
  console.log(`\n🔍 Benchmarking: ${name}`);
  console.log(`Running ${iterations} iterations...`);
  
  const times: number[] = [];
  
  // Warm up
  await fn();
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
    
    if ((i + 1) % 5 === 0) {
      console.log(`  Progress: ${i + 1}/${iterations}`);
    }
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const totalTime = times.reduce((a, b) => a + b, 0);
  
  const result: BenchmarkResult = {
    name,
    iterations,
    avgTime: Math.round(avgTime * 100) / 100,
    minTime: Math.round(minTime * 100) / 100,
    maxTime: Math.round(maxTime * 100) / 100,
    totalTime: Math.round(totalTime * 100) / 100,
  };
  
  console.log(`  ✅ Avg: ${result.avgTime}ms | Min: ${result.minTime}ms | Max: ${result.maxTime}ms`);
  
  return result;
}

async function runBenchmarks() {
  console.log('🚀 Starting Database Performance Benchmarks\n');
  console.log('=' .repeat(60));
  
  const results: BenchmarkResult[] = [];
  
  try {
    // Get sample data IDs
    const server = await db.server.findFirst();
    const profile = await db.profile.findFirst();
    const channel = await db.channel.findFirst();
    const conversation = await db.conversation.findFirst();
    
    if (!server || !profile || !channel) {
      console.log('⚠️  No sample data found. Please seed the database first.');
      return;
    }
    
    console.log('📊 Sample data loaded:');
    console.log(`  Server ID: ${server.id}`);
    console.log(`  Profile ID: ${profile.id}`);
    console.log(`  Channel ID: ${channel.id}`);
    if (conversation) console.log(`  Conversation ID: ${conversation.id}`);
    
    // Benchmark 1: Member lookup (CRITICAL)
    results.push(await benchmark(
      'Member Lookup (serverId + profileId)',
      async () => {
        await db.member.findFirst({
          where: {
            serverId: server.id,
            profileId: profile.id
          }
        });
      }
    ));
    
    // Benchmark 2: Message pagination (CRITICAL)
    results.push(await benchmark(
      'Message Pagination (channelId + orderBy createdAt)',
      async () => {
        await db.message.findMany({
          where: { channelId: channel.id },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
      }
    ));
    
    // Benchmark 3: Message pagination with cursor
    const firstMessage = await db.message.findFirst({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'desc' }
    });
    
    if (firstMessage) {
      results.push(await benchmark(
        'Message Pagination with Cursor',
        async () => {
          await db.message.findMany({
            where: { channelId: channel.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            skip: 1,
            cursor: { id: firstMessage.id }
          });
        }
      ));
    }
    
    // Benchmark 4: DM pagination
    if (conversation) {
      results.push(await benchmark(
        'DirectMessage Pagination (conversationId + orderBy)',
        async () => {
          await db.directMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'desc' },
            take: 10
          });
        }
      ));
    }
    
    // Benchmark 5: Channel list
    results.push(await benchmark(
      'Channel List (serverId)',
      async () => {
        await db.channel.findMany({
          where: { serverId: server.id },
          orderBy: { createdAt: 'asc' }
        });
      }
    ));
    
    // Benchmark 6: Member list
    results.push(await benchmark(
      'Member List (serverId)',
      async () => {
        await db.member.findMany({
          where: { serverId: server.id },
          include: { profile: true }
        });
      }
    ));
    
    // Benchmark 7: Channel permissions
    const member = await db.member.findFirst({
      where: { serverId: server.id, profileId: profile.id }
    });
    
    if (member) {
      results.push(await benchmark(
        'Channel Permission Check (channelId + memberId)',
        async () => {
          await db.channelPermission.findFirst({
            where: {
              channelId: channel.id,
              memberId: member.id
            }
          });
        }
      ));
    }
    
    // Benchmark 8: Conversation lookup
    if (conversation) {
      results.push(await benchmark(
        'Conversation Lookup (memberOneId + memberTwoId)',
        async () => {
          await db.conversation.findFirst({
            where: {
              AND: [
                { memberOneId: conversation.memberOneId },
                { memberTwoId: conversation.memberTwoId }
              ]
            }
          });
        }
      ));
    }
    
    // Benchmark 9: Server list by profile
    results.push(await benchmark(
      'Server List by Profile',
      async () => {
        await db.server.findMany({
          where: { profileId: profile.id },
          orderBy: { createdAt: 'desc' }
        });
      }
    ));
    
    // Benchmark 10: Profile lookup by userId
    results.push(await benchmark(
      'Profile Lookup by userId',
      async () => {
        await db.profile.findUnique({
          where: { userId: profile.userId }
        });
      }
    ));
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    
    // Sort by avgTime
    results.sort((a, b) => a.avgTime - b.avgTime);
    
    console.log('\n🏆 Fastest to Slowest:\n');
    results.forEach((result, index) => {
      const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const status = result.avgTime < 5 ? '✅ Excellent' : 
                     result.avgTime < 10 ? '✅ Good' : 
                     result.avgTime < 20 ? '⚠️  Fair' : 
                     '❌ Needs optimization';
      
      console.log(`${icon} ${index + 1}. ${result.name}`);
      console.log(`   Avg: ${result.avgTime}ms | Min: ${result.minTime}ms | Max: ${result.maxTime}ms | ${status}`);
      console.log('');
    });
    
    // Performance targets
    console.log('='.repeat(60));
    console.log('🎯 PERFORMANCE TARGETS:');
    console.log('='.repeat(60));
    console.log('✅ Excellent:  < 5ms');
    console.log('✅ Good:       5-10ms');
    console.log('⚠️  Fair:       10-20ms');
    console.log('❌ Poor:       > 20ms');
    console.log('');
    
    // Check if any queries are slow
    const slowQueries = results.filter(r => r.avgTime > 20);
    if (slowQueries.length > 0) {
      console.log('\n⚠️  SLOW QUERIES DETECTED:');
      slowQueries.forEach(query => {
        console.log(`  - ${query.name}: ${query.avgTime}ms`);
      });
      console.log('\nConsider adding indexes or optimizing these queries.');
    } else {
      console.log('\n🎉 All queries are performing well!');
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await db.$disconnect();
  }
}

// Run benchmarks
runBenchmarks()
  .then(() => {
    console.log('\n✅ Benchmarks completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

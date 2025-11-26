-- Database Performance Analysis Script
-- Run this in PostgreSQL to check index usage and query performance

-- ============================================
-- 1. CHECK ALL INDEXES
-- ============================================
\echo '========== ALL INDEXES =========='
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY tablename, indexname;

-- ============================================
-- 2. CHECK INDEX USAGE
-- ============================================
\echo '\n========== INDEX USAGE STATS =========='
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ============================================
-- 3. UNUSED INDEXES (Potential candidates for removal)
-- ============================================
\echo '\n========== UNUSED INDEXES =========='
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as wasted_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND indexname NOT LIKE '%_pkey'
    AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- 4. TABLE SIZES
-- ============================================
\echo '\n========== TABLE SIZES =========='
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 5. SLOW QUERIES (if pg_stat_statements enabled)
-- ============================================
\echo '\n========== TOP 10 SLOWEST QUERIES =========='
-- Uncomment if pg_stat_statements is enabled
-- SELECT 
--     substring(query, 1, 80) as query_snippet,
--     calls,
--     total_exec_time::numeric(10,2) as total_time_ms,
--     mean_exec_time::numeric(10,2) as avg_time_ms,
--     max_exec_time::numeric(10,2) as max_time_ms
-- FROM pg_stat_statements
-- ORDER BY mean_exec_time DESC
-- LIMIT 10;

-- ============================================
-- 6. TABLE STATISTICS
-- ============================================
\echo '\n========== TABLE STATISTICS =========='
SELECT 
    schemaname,
    relname as table_name,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================
-- 7. INDEX BLOAT (Approximate)
-- ============================================
\echo '\n========== INDEX HEALTH CHECK =========='
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW USAGE'
        WHEN idx_scan < 1000 THEN 'MEDIUM USAGE'
        ELSE 'HIGH USAGE'
    END as usage_level
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY usage_level, idx_scan DESC;

-- ============================================
-- 8. CACHE HIT RATIO (Should be > 95%)
-- ============================================
\echo '\n========== CACHE HIT RATIO =========='
SELECT 
    'Index Hit Rate' as metric,
    CASE 
        WHEN sum(idx_blks_hit) + sum(idx_blks_read) = 0 THEN 0
        ELSE round((sum(idx_blks_hit)::numeric / (sum(idx_blks_hit) + sum(idx_blks_read))) * 100, 2)
    END as percentage
FROM pg_statio_user_indexes
UNION ALL
SELECT 
    'Table Hit Rate' as metric,
    CASE 
        WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0 THEN 0
        ELSE round((sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read))) * 100, 2)
    END as percentage
FROM pg_statio_user_tables;

-- ============================================
-- 9. SPECIFIC QUERY ANALYSIS
-- ============================================
\echo '\n========== EXPLAIN ANALYZE EXAMPLES =========='
\echo 'Run these queries manually to check performance:'
\echo ''
\echo '-- Member lookup (should use Member_serverId_profileId_idx)'
\echo 'EXPLAIN ANALYZE SELECT * FROM "Member" WHERE "serverId" = ''your-server-id'' AND "profileId" = ''your-profile-id'';'
\echo ''
\echo '-- Message pagination (should use Message_channelId_createdAt_idx)'
\echo 'EXPLAIN ANALYZE SELECT * FROM "Message" WHERE "channelId" = ''your-channel-id'' ORDER BY "createdAt" DESC LIMIT 10;'
\echo ''
\echo '-- DM pagination (should use DirectMessage_conversationId_createdAt_idx)'
\echo 'EXPLAIN ANALYZE SELECT * FROM "DirectMessage" WHERE "conversationId" = ''your-conversation-id'' ORDER BY "createdAt" DESC LIMIT 10;'
\echo ''
\echo '-- Channel permissions (should use ChannelPermission_channelId_memberId_idx)'
\echo 'EXPLAIN ANALYZE SELECT * FROM "ChannelPermission" WHERE "channelId" = ''your-channel-id'' AND "memberId" = ''your-member-id'';'

-- ============================================
-- 10. RECOMMENDATIONS
-- ============================================
\echo '\n========== RECOMMENDATIONS =========='
\echo 'Based on the above statistics:'
\echo '1. Indexes with 0 scans should be removed (after confirming not needed)'
\echo '2. Cache hit ratio should be > 95% (add more RAM if lower)'
\echo '3. Tables with high dead_rows need VACUUM'
\echo '4. Run ANALYZE regularly to update statistics'
\echo '5. Monitor slow queries and add indexes as needed'

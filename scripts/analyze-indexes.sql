-- Quick Index Analysis
\echo '========== ALL INDEXES =========='
SELECT 
    schemaname,
    tablename as table_name,
    indexname as index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo '========== INDEX USAGE =========='
SELECT 
    tablename as table_name,
    indexname as index_name,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN '❌ UNUSED'
        WHEN idx_scan < 10 THEN '⚠️  LOW'
        WHEN idx_scan < 100 THEN '✅ MEDIUM'
        ELSE '✅ HIGH'
    END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC, tablename;

\echo ''
\echo '========== TABLE SIZES =========='
SELECT 
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname::text)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||relname::text)) as table_size,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

\echo ''
\echo '========== CACHE HIT RATIO =========='
SELECT 
    'Index Hit Rate' as metric,
    round((sum(idx_blks_hit)::numeric / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0)) * 100, 2) || '%' as percentage
FROM pg_statio_user_indexes
UNION ALL
SELECT 
    'Table Hit Rate' as metric,
    round((sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0)) * 100, 2) || '%' as percentage
FROM pg_statio_user_tables;

-- Database Index Analysis Queries
-- Use these queries to monitor index usage and performance

-- 1. Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC;

-- 2. Find unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. Check table sizes and index sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
  pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size,
  pg_size_pretty(pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- 4. Slow query analysis (requires pg_stat_statements extension)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- 5. Check for missing indexes on foreign keys
SELECT 
  c.conname AS constraint_name,
  t.relname AS table_name,
  array_agg(a.attname ORDER BY a.attnum) AS columns
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND i.indkey::int2[] @> c.conkey::int2[]
  )
GROUP BY c.conname, t.relname;

-- 6. Index bloat analysis
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE 
    WHEN pg_relation_size(indexrelid) > 100000000 THEN 'Consider REINDEX'
    ELSE 'OK'
  END as recommendation
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

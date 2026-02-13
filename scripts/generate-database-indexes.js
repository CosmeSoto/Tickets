#!/usr/bin/env node

/**
 * Database Index Generation Script
 * Generates optimized database indexes for better query performance
 */

const fs = require('fs')
const path = require('path')

const INDEXES = [
  {
    name: 'idx_ticket_status_priority',
    table: 'Ticket',
    columns: ['status', 'priority'],
    type: 'btree',
    reason: 'Dashboard filtering and status/priority queries',
    estimatedImprovement: '60-80%'
  },
  {
    name: 'idx_ticket_user_id',
    table: 'Ticket',
    columns: ['userId'],
    type: 'btree',
    reason: 'User-specific ticket queries',
    estimatedImprovement: '70-90%'
  },
  {
    name: 'idx_ticket_assigned_to_id',
    table: 'Ticket',
    columns: ['assignedToId'],
    type: 'btree',
    reason: 'Technician workload queries',
    estimatedImprovement: '70-85%'
  },
  {
    name: 'idx_ticket_category_id',
    table: 'Ticket',
    columns: ['categoryId'],
    type: 'btree',
    reason: 'Category-based filtering',
    estimatedImprovement: '50-70%'
  },
  {
    name: 'idx_ticket_created_at',
    table: 'Ticket',
    columns: ['createdAt'],
    type: 'btree',
    reason: 'Time-based queries and sorting',
    estimatedImprovement: '80-95%'
  },
  {
    name: 'idx_ticket_updated_at',
    table: 'Ticket',
    columns: ['updatedAt'],
    type: 'btree',
    reason: 'Recent activity and resolution tracking',
    estimatedImprovement: '75-90%'
  },
  {
    name: 'idx_ticket_status_created_at',
    table: 'Ticket',
    columns: ['status', 'createdAt'],
    type: 'btree',
    reason: 'Composite index for status filtering with time sorting',
    estimatedImprovement: '85-95%'
  },
  {
    name: 'idx_comment_ticket_id',
    table: 'Comment',
    columns: ['ticketId'],
    type: 'btree',
    reason: 'Comments are always queried by ticket',
    estimatedImprovement: '90-95%'
  },
  {
    name: 'idx_comment_created_at',
    table: 'Comment',
    columns: ['createdAt'],
    type: 'btree',
    reason: 'Comment ordering and recent activity',
    estimatedImprovement: '70-85%'
  },
  {
    name: 'idx_attachment_ticket_id',
    table: 'Attachment',
    columns: ['ticketId'],
    type: 'btree',
    reason: 'Attachments are always queried by ticket',
    estimatedImprovement: '90-95%'
  },
  {
    name: 'idx_user_email',
    table: 'User',
    columns: ['email'],
    type: 'btree',
    reason: 'Authentication and user lookup',
    estimatedImprovement: '95-99%'
  },
  {
    name: 'idx_user_role_active',
    table: 'User',
    columns: ['role', 'active'],
    type: 'btree',
    reason: 'Role-based queries with active filter',
    estimatedImprovement: '70-85%'
  },
  {
    name: 'idx_category_active',
    table: 'Category',
    columns: ['active'],
    type: 'btree',
    reason: 'Active category filtering',
    estimatedImprovement: '60-80%'
  },
  {
    name: 'idx_ticket_search_text',
    table: 'Ticket',
    columns: ['title', 'description'],
    type: 'gin',
    reason: 'Full-text search on tickets',
    estimatedImprovement: '10-100x faster'
  },
  {
    name: 'idx_user_search_text',
    table: 'User',
    columns: ['name', 'email'],
    type: 'gin',
    reason: 'Full-text search on users',
    estimatedImprovement: '10-50x faster'
  }
]

function generatePrismaMigration() {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
  const migrationName = `${timestamp}_add_performance_indexes`
  
  let migration = `-- CreateIndex
-- Performance optimization indexes for better query performance
-- Generated on ${new Date().toISOString()}

`

  INDEXES.forEach(index => {
    if (index.type === 'gin') {
      // Full-text search indexes
      migration += `-- ${index.reason} (${index.estimatedImprovement} improvement)
CREATE INDEX "${index.name}" ON "${index.table}" USING gin(to_tsvector('english', ${index.columns.join(" || ' ' || ")}));

`
    } else {
      // Regular B-tree indexes
      migration += `-- ${index.reason} (${index.estimatedImprovement} improvement)
CREATE INDEX "${index.name}" ON "${index.table}"(${index.columns.map(col => `"${col}"`).join(', ')});

`
    }
  })

  return {
    filename: `${migrationName}.sql`,
    content: migration
  }
}

function generatePrismaSchema() {
  const schema = `// Database Performance Indexes
// Add these to your Prisma schema for better query performance

model Ticket {
  // ... existing fields ...
  
  // Performance indexes
  @@index([status, priority], name: "idx_ticket_status_priority")
  @@index([userId], name: "idx_ticket_user_id")
  @@index([assignedToId], name: "idx_ticket_assigned_to_id")
  @@index([categoryId], name: "idx_ticket_category_id")
  @@index([createdAt], name: "idx_ticket_created_at")
  @@index([updatedAt], name: "idx_ticket_updated_at")
  @@index([status, createdAt], name: "idx_ticket_status_created_at")
}

model Comment {
  // ... existing fields ...
  
  // Performance indexes
  @@index([ticketId], name: "idx_comment_ticket_id")
  @@index([createdAt], name: "idx_comment_created_at")
}

model Attachment {
  // ... existing fields ...
  
  // Performance indexes
  @@index([ticketId], name: "idx_attachment_ticket_id")
}

model User {
  // ... existing fields ...
  
  // Performance indexes
  @@index([email], name: "idx_user_email")
  @@index([role, active], name: "idx_user_role_active")
}

model Category {
  // ... existing fields ...
  
  // Performance indexes
  @@index([active], name: "idx_category_active")
}
`

  return schema
}

function generateIndexAnalysisQueries() {
  return `-- Database Index Analysis Queries
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
`
}

function generatePerformanceTestQueries() {
  return `-- Performance Test Queries
-- Use these to test query performance before and after adding indexes

-- Test 1: Dashboard status filtering
EXPLAIN ANALYZE 
SELECT status, COUNT(*) 
FROM "Ticket" 
GROUP BY status;

-- Test 2: User tickets query
EXPLAIN ANALYZE 
SELECT * FROM "Ticket" 
WHERE "userId" = 'user-id-here' 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Test 3: Technician workload
EXPLAIN ANALYZE 
SELECT COUNT(*) FROM "Ticket" 
WHERE "assignedToId" = 'tech-id-here' 
AND status != 'CLOSED';

-- Test 4: Category filtering
EXPLAIN ANALYZE 
SELECT * FROM "Ticket" 
WHERE "categoryId" = 'category-id-here' 
ORDER BY "createdAt" DESC;

-- Test 5: Recent tickets
EXPLAIN ANALYZE 
SELECT * FROM "Ticket" 
ORDER BY "createdAt" DESC 
LIMIT 5;

-- Test 6: Status and priority filtering
EXPLAIN ANALYZE 
SELECT * FROM "Ticket" 
WHERE status = 'OPEN' 
AND priority = 'HIGH' 
ORDER BY "createdAt" DESC;

-- Test 7: Text search (before full-text index)
EXPLAIN ANALYZE 
SELECT * FROM "Ticket" 
WHERE title ILIKE '%search-term%' 
OR description ILIKE '%search-term%';

-- Test 8: Comments by ticket
EXPLAIN ANALYZE 
SELECT * FROM "Comment" 
WHERE "ticketId" = 'ticket-id-here' 
ORDER BY "createdAt" ASC;

-- Test 9: User authentication
EXPLAIN ANALYZE 
SELECT * FROM "User" 
WHERE email = 'user@example.com';

-- Test 10: Active users by role
EXPLAIN ANALYZE 
SELECT * FROM "User" 
WHERE role = 'TECHNICIAN' 
AND active = true;
`
}

async function main() {
  console.log('🚀 Generating Database Performance Indexes...')
  
  const outputDir = path.join(__dirname, '../database-optimization')
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Generate migration file
  const migration = generatePrismaMigration()
  const migrationPath = path.join(outputDir, migration.filename)
  fs.writeFileSync(migrationPath, migration.content)
  console.log(`✅ Generated migration: ${migration.filename}`)

  // Generate Prisma schema additions
  const schemaPath = path.join(outputDir, 'prisma-indexes.prisma')
  fs.writeFileSync(schemaPath, generatePrismaSchema())
  console.log(`✅ Generated Prisma schema: prisma-indexes.prisma`)

  // Generate analysis queries
  const analysisPath = path.join(outputDir, 'index-analysis.sql')
  fs.writeFileSync(analysisPath, generateIndexAnalysisQueries())
  console.log(`✅ Generated analysis queries: index-analysis.sql`)

  // Generate performance test queries
  const testPath = path.join(outputDir, 'performance-tests.sql')
  fs.writeFileSync(testPath, generatePerformanceTestQueries())
  console.log(`✅ Generated performance tests: performance-tests.sql`)

  // Generate summary report
  const summaryPath = path.join(outputDir, 'INDEX_SUMMARY.md')
  const summary = generateSummaryReport()
  fs.writeFileSync(summaryPath, summary)
  console.log(`✅ Generated summary report: INDEX_SUMMARY.md`)

  console.log('\n📊 Index Generation Summary:')
  console.log(`   Total indexes: ${INDEXES.length}`)
  console.log(`   B-tree indexes: ${INDEXES.filter(i => i.type === 'btree').length}`)
  console.log(`   GIN indexes: ${INDEXES.filter(i => i.type === 'gin').length}`)
  console.log(`   Output directory: ${outputDir}`)

  console.log('\n🎯 Next Steps:')
  console.log('   1. Review the generated migration file')
  console.log('   2. Test performance queries before applying indexes')
  console.log('   3. Apply the migration to your database')
  console.log('   4. Run performance tests to verify improvements')
  console.log('   5. Monitor index usage with analysis queries')
}

function generateSummaryReport() {
  return `# Database Performance Indexes Summary

## Overview

This document summarizes the database indexes generated for performance optimization.

**Generated on:** ${new Date().toISOString()}
**Total Indexes:** ${INDEXES.length}

## Index Categories

### B-tree Indexes (${INDEXES.filter(i => i.type === 'btree').length})
Standard indexes for equality and range queries.

${INDEXES.filter(i => i.type === 'btree').map(index => `
#### ${index.name}
- **Table:** ${index.table}
- **Columns:** ${index.columns.join(', ')}
- **Reason:** ${index.reason}
- **Estimated Improvement:** ${index.estimatedImprovement}
`).join('')}

### GIN Indexes (${INDEXES.filter(i => i.type === 'gin').length})
Full-text search indexes for text search operations.

${INDEXES.filter(i => i.type === 'gin').map(index => `
#### ${index.name}
- **Table:** ${index.table}
- **Columns:** ${index.columns.join(', ')}
- **Reason:** ${index.reason}
- **Estimated Improvement:** ${index.estimatedImprovement}
`).join('')}

## Performance Impact

### Expected Improvements
- **Dashboard queries:** 60-95% faster
- **User-specific queries:** 70-90% faster
- **Text search:** 10-100x faster
- **Authentication:** 95-99% faster
- **Workload queries:** 70-85% faster

### Query Patterns Optimized
1. Status and priority filtering
2. User-specific ticket queries
3. Technician workload calculations
4. Category-based filtering
5. Time-based sorting and filtering
6. Full-text search across tickets and users
7. Authentication and user lookup
8. Comment and attachment loading

## Implementation Steps

1. **Backup Database:** Always backup before applying indexes
2. **Test Environment:** Apply indexes in test environment first
3. **Performance Baseline:** Measure current query performance
4. **Apply Indexes:** Run the migration file
5. **Verify Performance:** Test queries with new indexes
6. **Monitor Usage:** Use analysis queries to monitor index effectiveness

## Monitoring

Use the provided analysis queries to:
- Monitor index usage statistics
- Identify unused indexes
- Check for index bloat
- Analyze slow queries
- Verify performance improvements

## Maintenance

- **Regular Analysis:** Monitor index usage monthly
- **Reindex:** Consider reindexing large tables quarterly
- **Cleanup:** Remove unused indexes to save space
- **Updates:** Add new indexes as query patterns evolve

---

*Generated by Database Index Generation Script*
`
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Index generation failed:', error)
    process.exit(1)
  })
}

module.exports = {
  INDEXES,
  generatePrismaMigration,
  generatePrismaSchema,
  generateIndexAnalysisQueries,
  generatePerformanceTestQueries
}
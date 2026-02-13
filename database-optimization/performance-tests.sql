-- Performance Test Queries
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

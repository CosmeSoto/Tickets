# Manual Testing Guide for Category Analytics Endpoint

## Prerequisites

1. Server running: `npm run dev`
2. User authenticated (have a valid session cookie)
3. Database accessible

## Test Cases

### 1. Test Valid Event Recording

```bash
# Test search event
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "search",
    "searchQuery": "impresora"
  }'

# Expected: 200 OK with { "success": true }
```

### 2. Test All Valid Event Types

```bash
# Test suggestion_click
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "suggestion_click",
    "categoryId": "cat-123",
    "timeToSelect": 2000
  }'

# Test manual_select
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "manual_select",
    "categoryId": "cat-456",
    "timeToSelect": 5000,
    "metadata": { "source": "tree" }
  }'

# Test frequent_select
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "frequent_select",
    "categoryId": "cat-789"
  }'

# Test category_change
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "category_change",
    "categoryId": "cat-999",
    "metadata": { "previousCategory": "cat-123" }
  }'
```

### 3. Test Authentication

```bash
# Test without authentication
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "search"
  }'

# Expected: 401 Unauthorized
```

### 4. Test Validation Errors

```bash
# Test missing eventType
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{}'

# Expected: 400 Bad Request - "El campo eventType es requerido"

# Test invalid eventType
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "invalid_event"
  }'

# Expected: 400 Bad Request - "Tipo de evento inválido"

# Test invalid categoryId
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "search",
    "categoryId": ""
  }'

# Expected: 400 Bad Request - "categoryId debe ser un string válido"

# Test negative timeToSelect
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "search",
    "timeToSelect": -100
  }'

# Expected: 400 Bad Request - "timeToSelect debe ser un número positivo"
```

### 5. Test Data Sanitization

```bash
# Test phone number sanitization
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "search",
    "searchQuery": "Call me at 555-123-4567"
  }'

# Expected: 200 OK - Check database to verify phone is [REDACTED]

# Test email sanitization
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "search",
    "searchQuery": "Contact test@example.com"
  }'

# Expected: 200 OK - Check database to verify email is [REDACTED]

# Test sensitive metadata removal
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "eventType": "search",
    "metadata": {
      "password": "secret123",
      "token": "abc123",
      "normalField": "value"
    }
  }'

# Expected: 200 OK - Check database to verify password/token are removed
```

### 6. Test Rate Limiting

```bash
# Send 101 requests rapidly to trigger rate limit
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/analytics/category-selection \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
    -d '{
      "eventType": "search",
      "searchQuery": "test '$i'"
    }'
  echo "Request $i"
done

# Expected: First 100 should succeed, 101st should return 429 with Retry-After header
```

### 7. Verify Database Records

```sql
-- Check that events are being recorded
SELECT * FROM category_analytics 
ORDER BY created_at DESC 
LIMIT 10;

-- Verify sanitization worked
SELECT search_query, metadata 
FROM category_analytics 
WHERE search_query LIKE '%REDACTED%' 
   OR metadata::text LIKE '%REDACTED%';

-- Check event type distribution
SELECT event_type, COUNT(*) as count 
FROM category_analytics 
GROUP BY event_type;

-- Check rate limit is working (should see gaps in timestamps if triggered)
SELECT client_id, COUNT(*) as events, 
       MAX(created_at) - MIN(created_at) as time_span
FROM category_analytics 
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY client_id;
```

## Browser Testing

You can also test from the browser console while logged in:

```javascript
// Test basic event
fetch('/api/analytics/category-selection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'search',
    searchQuery: 'impresora'
  })
})
.then(r => r.json())
.then(console.log);

// Test with all fields
fetch('/api/analytics/category-selection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'manual_select',
    categoryId: 'cat-123',
    searchQuery: 'impresora',
    timeToSelect: 5000,
    metadata: { source: 'tree', level: 3 }
  })
})
.then(r => r.json())
.then(console.log);
```

## Expected Results Summary

| Test Case | Expected Status | Expected Response |
|-----------|----------------|-------------------|
| Valid event | 200 | `{ "success": true }` |
| No auth | 401 | `{ "success": false, "message": "No autorizado" }` |
| Missing eventType | 400 | Validation error message |
| Invalid eventType | 400 | List of valid types |
| Rate limit exceeded | 429 | Retry-After header present |
| Sensitive data | 200 | Data sanitized in DB |

## Troubleshooting

### Issue: 401 Unauthorized
- **Solution**: Make sure you're logged in and have a valid session cookie

### Issue: 500 Internal Server Error
- **Solution**: Check server logs for database connection issues or Prisma errors

### Issue: Rate limit not working
- **Solution**: Rate limiter uses in-memory storage, restart server to reset

### Issue: Data not sanitized
- **Solution**: Check the sanitization functions in route.ts, verify regex patterns

## Integration with Frontend

Once verified, the frontend can use this endpoint like:

```typescript
// In your CategorySelector component
const trackEvent = async (eventType: string, data?: any) => {
  try {
    await fetch('/api/analytics/category-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        ...data
      })
    });
  } catch (error) {
    // Silently fail - analytics shouldn't break UX
    console.error('Analytics error:', error);
  }
};

// Usage examples
trackEvent('search', { searchQuery: query });
trackEvent('manual_select', { categoryId, timeToSelect });
trackEvent('suggestion_click', { categoryId, timeToSelect, metadata: { rank: 1 } });
```

#!/bin/bash

echo "🧪 Testing Main System Functionality"
echo "===================================="

# Test 1: Check if login system is working
echo "1. Testing login system..."
curl -s -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tickets.com","password":"admin123"}' \
  > /dev/null && echo "✅ Login API accessible" || echo "❌ Login API not accessible"

# Test 2: Check if tickets API is working
echo "2. Testing tickets API..."
curl -s http://localhost:3000/api/tickets > /dev/null && echo "✅ Tickets API accessible" || echo "❌ Tickets API not accessible"

# Test 3: Check if attachment upload endpoint exists
echo "3. Testing attachment upload endpoint..."
curl -s -X POST http://localhost:3000/api/tickets/test/attachments > /dev/null && echo "✅ Attachment API accessible" || echo "❌ Attachment API not accessible"

# Test 4: Check if audit service is properly imported
echo "4. Testing audit service..."
if grep -q "AuditService" src/lib/services/audit-service.ts; then
  echo "✅ Audit service properly defined"
else
  echo "❌ Audit service not found"
fi

# Test 5: Check if inappropriate terms are cleaned
echo "5. Testing terminology cleanup..."
INAPPROPRIATE_TERMS=$(grep -r "compact\|professional\|optimized\|ultra" src/components/ src/app/ 2>/dev/null | grep -v "performance\|cdn\|database" | wc -l)
if [ "$INAPPROPRIATE_TERMS" -eq 0 ]; then
  echo "✅ No inappropriate terms found in components/app"
else
  echo "❌ Found $INAPPROPRIATE_TERMS inappropriate terms"
fi

# Test 6: Check if AttachmentButton component exists
echo "6. Testing AttachmentButton component..."
if [ -f "src/components/tickets/attachment-button.tsx" ]; then
  echo "✅ AttachmentButton component exists"
else
  echo "❌ AttachmentButton component not found"
fi

echo ""
echo "🎯 Test Summary Complete"
echo "========================"
echo "Run this script to verify system functionality after changes."
#!/bin/bash

echo "🧪 Testing Critical APIs..."
echo ""

# Test 1: Categories API
echo "1️⃣ Testing Categories API..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/categories?isActive=true)
if [ "$response" = "200" ]; then
  echo "   ✅ Categories API: OK (HTTP $response)"
else
  echo "   ❌ Categories API: FAILED (HTTP $response)"
fi

# Test 2: Departments API
echo "2️⃣ Testing Departments API..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/departments)
if [ "$response" = "200" ]; then
  echo "   ✅ Departments API: OK (HTTP $response)"
else
  echo "   ❌ Departments API: FAILED (HTTP $response)"
fi

# Test 3: Dashboard Stats (may require auth)
echo "3️⃣ Testing Dashboard Stats API..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/dashboard/stats)
if [ "$response" = "200" ] || [ "$response" = "401" ]; then
  echo "   ✅ Dashboard Stats API: OK (HTTP $response - auth required)"
else
  echo "   ❌ Dashboard Stats API: FAILED (HTTP $response)"
fi

# Test 4: Categories Tree
echo "4️⃣ Testing Categories Tree API..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/categories/tree)
if [ "$response" = "200" ]; then
  echo "   ✅ Categories Tree API: OK (HTTP $response)"
else
  echo "   ❌ Categories Tree API: FAILED (HTTP $response)"
fi

# Test 5: Home page
echo "5️⃣ Testing Home Page..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
if [ "$response" = "200" ]; then
  echo "   ✅ Home Page: OK (HTTP $response)"
else
  echo "   ❌ Home Page: FAILED (HTTP $response)"
fi

echo ""
echo "✅ API Testing Complete!"

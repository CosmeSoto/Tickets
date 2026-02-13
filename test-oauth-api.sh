#!/bin/bash

echo "🧪 Testing OAuth Config API"
echo "=============================="
echo ""

# Get the session cookie first (you'll need to login manually and copy the cookie)
echo "Note: You need to be logged in as ADMIN to test this API"
echo ""
echo "Testing GET /api/admin/oauth-config..."
echo ""

# Test without authentication (should redirect or return 401)
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/admin/oauth-config

echo ""
echo "=============================="
echo "If you see a redirect to /api/auth/signin, the API is working but requires authentication"
echo "If you see 500 error, check the server logs for details"

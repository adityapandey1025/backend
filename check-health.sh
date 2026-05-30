#!/bin/bash

# SyncMusic Backend Health Check
echo "🔍 Checking Backend Health..."

BACKEND_URL="https://syncmusic-backend-fnpx.onrender.com"

# Check if backend is running
if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" | grep -q "200"; then
  echo "✅ Backend is running!"
  curl -s "$BACKEND_URL/health" | jq .
else
  echo "❌ Backend is not responding"
fi

# Check MongoDB connection
echo ""
echo "🔍 Checking MongoDB Connection..."
if curl -s "$BACKEND_URL/" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ MongoDB connection successful!"
else
  echo "⚠️  Checking MongoDB..."
fi

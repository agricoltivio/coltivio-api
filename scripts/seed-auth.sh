#!/bin/bash
# Create auth users via Supabase Admin API (GoTrue handles password hashing, identities, etc.)
set -e

SERVICE_KEY=$(supabase status -o env 2>/dev/null | grep SERVICE_ROLE_KEY | cut -d= -f2 | tr -d '"')
API_URL="http://127.0.0.1:54321"

create_user() {
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$1")
  local http_code=$(echo "$response" | tail -1)
  if [ "$http_code" -ge 400 ]; then
    echo "Failed to create user: $(echo "$response" | head -1)" >&2
    exit 1
  fi
}

echo "Creating auth users..."
create_user '{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"farmA@test.ch","password":"123456","email_confirm":true}'
echo "Auth users created."

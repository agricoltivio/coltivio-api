#!/bin/bash
# Creates auth users via the public signup endpoint (no admin JWT needed),
# captures the generated UUID, then runs seed.sql with that UUID substituted in.
set -e

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

PUBLISHABLE_KEY=$(supabase status -o env 2>/dev/null | grep '^PUBLISHABLE_KEY=' | cut -d= -f2 | tr -d '"')
if [ -z "$PUBLISHABLE_KEY" ]; then
  PUBLISHABLE_KEY=$(supabase status -o env 2>/dev/null | grep '^ANON_KEY=' | cut -d= -f2 | tr -d '"')
fi

echo "Creating auth users..."

RESPONSE=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/signup" \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"farmA@test.ch","password":"123456"}')

USER_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")

if [ -z "$USER_ID" ]; then
  echo "Failed to get user ID from signup response: $RESPONSE" >&2
  exit 1
fi

echo "Auth user created: $USER_ID"

echo "Seeding database..."
sed "s/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/$USER_ID/g" "$SCRIPT_DIR/../supabase/seed.sql" | psql "$DB_URL"
echo "Done."

#!/usr/bin/env bash
# Prints the two environment variables that turn on desktop push notifications.
# Run once, put the lines in Render's environment, and keep the private key secret.
set -euo pipefail
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
b64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }
openssl ecparam -name prime256v1 -genkey -noout -out "$tmp"
private=$(openssl ec -in "$tmp" -outform DER 2>/dev/null | tail -c +8 | head -c 32 | b64url)
public=$(openssl ec -in "$tmp" -pubout -outform DER 2>/dev/null | tail -c 65 | b64url)
echo "VAPID_PUBLIC_KEY=$public"
echo "VAPID_PRIVATE_KEY=$private"

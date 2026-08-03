#!/bin/bash

# publish-dns-aid.sh
# This script publishes DNS for AI Discovery (DNS-AID) records to Cloudflare.
# It adds the required SVCB records and enables DNSSEC.

set -e

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "Error: CLOUDFLARE_API_TOKEN is not set."
  echo "Please set your Cloudflare API token (requires Zone.DNS and Zone.Zone Settings permissions)."
  exit 1
fi

if [ -z "$CLOUDFLARE_ZONE_ID" ]; then
  echo "Error: CLOUDFLARE_ZONE_ID is not set."
  echo "Please set your Cloudflare Zone ID for promptroot.ai."
  exit 1
fi

DOMAIN="promptroot.ai"
TARGET_DOMAIN="promptroot.ai"

echo "Publishing DNS-AID records for $DOMAIN..."

# Add _a2a._agents record
echo "Adding _a2a._agents SVCB record..."
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{
       "type": "SVCB",
       "name": "_a2a._agents",
       "content": "1 '"$TARGET_DOMAIN"'. alpn=\"a2a\" port=443 mandatory=alpn,port",
       "ttl": 3600,
       "proxied": false,
       "comment": "DNS-AID agent-to-agent discovery record"
     }'

# Add _index._agents record
echo "Adding _index._agents SVCB record..."
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{
       "type": "SVCB",
       "name": "_index._agents",
       "content": "1 '"$TARGET_DOMAIN"'. alpn=\"h2,h3\" port=443 mandatory=alpn,port",
       "ttl": 3600,
       "proxied": false,
       "comment": "DNS-AID index discovery record"
     }'

# Enable DNSSEC
echo "Enabling DNSSEC for the zone..."
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dnssec" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"status":"active"}'

echo ""
echo "DNS-AID records published and DNSSEC enabled successfully."
echo "You can verify the records using:"
echo "dig +short SVCB _a2a._agents.$DOMAIN"
echo "dig +short SVCB _index._agents.$DOMAIN"

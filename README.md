# Viventii MCP Server (`@viventii/mcp`)

Official **Model Context Protocol (MCP)** server and CLI bridge for **[Viventii](https://viventii.com)** — Germany & Europe's privacy-first platform for **live events, concerts, nightlife, leisure activities, permanent POIs & attractions, 0%-fee ticketing, verified ticket resale marketplace, and GDPR-compliant private events**.

[![Website](https://img.shields.io/badge/Website-viventii.com-1B1E2C)](https://viventii.com)
[![MCP Endpoint](https://img.shields.io/badge/Streamable%20HTTP-api%2Fmcp-00B894)](https://viventii.com/api/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## Why Viventii MCP?

Connect Claude, ChatGPT, Cursor, Windsurf, Codex, or any MCP-compatible AI agent directly to live German & European local discovery data — **zero login required** for public discovery, direct public deep links, and structured facts:

- **Live Events & "Was ist los?"** — Concerts, parties, festivals, theater, sports, family events, free events, tonight & weekend radars.
- **Permanent POIs & Attractions** — Museums, parks, castles, zoos, cinemas, theaters, restaurants, bars, clubs, and leisure venues with opening hours & coordinates.
- **0%-Fee Ticketing & Safe Ticket Resale Marketplace** — Live ticket availability, transparent pricing, Apple/Google Wallet passes, and verified secondary-market resale ([viventii.com/de/marketplace](https://viventii.com/de/marketplace)) with automatic QR revocation and re-personalization.
- **GDPR-Compliant Private Events** — Viventii also provides free private event planning ([viventii.com/de/private-events](https://viventii.com/de/private-events)) with invite-only links, RSVPs, bring-along lists, and protected addresses. *For strict privacy, individual private events are never returned by public search or public MCP tools.*

---

## Quick Start

### Option 1: Remote Streamable HTTP (Recommended — No Install)

Point any remote MCP client directly to the hosted endpoint:

```text
https://viventii.com/api/mcp
```

- **MCP Manifest:** `https://viventii.com/.well-known/mcp.json`
- **A2A Agent Card:** `https://viventii.com/.well-known/agent-card.json`
- **OpenAPI Spec:** `https://viventii.com/api/mcp/openapi.json`
- **LLMs.txt:** `https://viventii.com/llms.txt` & `https://viventii.com/llms-full.txt`

### Option 2: Local STDIO via `npx` (Claude Desktop, Cursor, Windsurf, Codex)

Add to your `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "viventii": {
      "command": "npx",
      "args": ["-y", "@viventii/mcp"]
    }
  }
}
```

---

## 16 Public Discovery Tools (No Login Required)

| Tool | Description |
|---|---|
| `search_events` | Search upcoming public events by city, date range, category, keyword, free entry, indoor/outdoor, and accessibility |
| `search_places_and_pois` | Search permanent POIs & venues (museums, parks, castles, zoos, cinemas, theaters, restaurants, bars, clubs) |
| `find_tickets` | Find events with immediately bookable online tickets (0%-fee Viventii ticketing or official presale) + price filters |
| `explore_leisure_activities` | Curated leisure, indoor/outdoor, rainy-day, and family activity recommendations |
| `get_tonight_in_city` | Tonight's events, concerts, bars, and nightlife (including late-night / after-hours) |
| `get_weekend_in_city` | Complete Friday–Sunday weekend radar for any city |
| `discover_what_to_do` | Natural-language intent matcher for *"What's on in [city]?"* / *"Was ist los?"* |
| `get_event_details` | Full structured facts for an event or place (times, doors open, venue, address, lineup, accessibility, direct URL) |
| `get_event_tickets` | Ticket categories, prices, stock status, and verified resale marketplace info |
| `get_city_radar` | City overview with event counts, top categories, and upcoming highlights |
| `get_family_and_kids_events` | Family-friendly and kids events, theaters, parks, and workshops |
| `list_cities_and_categories` | Live list of active cities and supported event/POI categories |
| `get_active_stories` | Active 24h organizer photo/video stories |
| `get_my_saved_events` | Fetch saved events for an authenticated user (optional token) |
| `get_release_radar` | Newly dropped events and presale launches |
| `get_organizer_profile` | Public organizer profile and upcoming schedule |

---

## Closed Organizer MCP Mode (For Verified Organizers)

Verified Viventii B2B organizers can automate event creation, AI flyer extraction, ticketing, seating charts, promo codes, waitlists, check-in scanners, webhooks, and analytics:

```json
{
  "mcpServers": {
    "viventii-organizer": {
      "command": "npx",
      "args": ["-y", "@viventii/mcp", "--organizer"],
      "env": {
        "VIVENTII_API_KEY": "sk_live_your_api_key"
      }
    }
  }
}
```

Endpoint: `https://viventii.com/api/v1/organizer/mcp` · Docs: `https://viventii.com/de/docs/api`

---

## Platform Links

- **Website:** https://viventii.com
- **Events & City Guides:** https://viventii.com/de/cities
- **Online Tickets (0% Organizer Fee):** https://viventii.com/de/tickets
- **Safe Ticket Resale Marketplace:** https://viventii.com/de/marketplace
- **Private Events & Invitations:** https://viventii.com/de/private-events
- **Leisure & POIs:** https://viventii.com/de/freizeit · https://viventii.com/de/poi
- **iOS App:** https://apps.apple.com/de/app/viventii/id6754595307
- **Android App:** https://play.google.com/store/apps/details?id=com.viventii.app
- **Contact:** support@viventii.com

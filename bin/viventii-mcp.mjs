#!/usr/bin/env node

/**
 * @fileOverview Viventii MCP CLI Client Bridge for Claude Desktop, Cursor, Windsurf & Codex.
 *
 * Dual-Mode Transport:
 * 1. Public Discovery Mode (default): `npx @viventii/mcp` -> bridges STDIO to `/api/mcp` (16 public tools, no login).
 * 2. Closed Organizer Mode (`--organizer`, `VIVENTII_MCP_MODE=organizer`, or binary `viventii-organizer-mcp`):
 *    transparently bridges STDIO JSON-RPC 2.0 over HTTPS to `/api/v1/organizer/mcp` using `VIVENTII_API_KEY`
 *    (or `--api-key <sk_live_...|sk_test_...>`).
 */

import path from 'node:path';
import readline from 'node:readline';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_BASE_URL = (process.env.VIVENTII_API_URL || 'https://viventii.com').replace(/\/+$/, '');
const VERSION = '3.3.0';

function parseCliOptions(argv) {
  let organizerMode =
    String(process.env.VIVENTII_MCP_MODE || '').toLowerCase() === 'organizer' ||
    path.basename(argv[1] || '').toLowerCase().includes('organizer-mcp');
  let apiKey = process.env.VIVENTII_API_KEY || '';
  let baseUrl = API_BASE_URL;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--organizer' || arg === '-o') {
      organizerMode = true;
    } else if (arg === '--public') {
      organizerMode = false;
    } else if (arg.startsWith('--api-key=')) {
      apiKey = arg.slice('--api-key='.length).trim();
    } else if (arg === '--api-key' && argv[i + 1]) {
      apiKey = argv[++i].trim();
    } else if (arg.startsWith('--url=')) {
      baseUrl = arg.slice('--url='.length).trim().replace(/\/+$/, '');
    } else if (arg === '--url' && argv[i + 1]) {
      baseUrl = argv[++i].trim().replace(/\/+$/, '');
    }
  }

  return { organizerMode, apiKey, baseUrl };
}

async function runClosedOrganizerBridge(baseUrl, apiKey) {
  if (!apiKey) {
    console.error(
      '[viventii-organizer-mcp] Missing VIVENTII_API_KEY (or --api-key sk_live_... / sk_test_...). Refusing to start.'
    );
    process.exit(1);
  }

  const endpoint = `${baseUrl}/api/v1/organizer/mcp`;
  let mcpSessionId = null;

  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', async (rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error: Invalid JSON' },
        })}\n`
      );
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `Viventii-Organizer-MCP-CLI/${VERSION}`,
      };
      if (mcpSessionId) {
        headers['Mcp-Session-Id'] = mcpSessionId;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(msg),
      });

      const returnedSession = res.headers.get('mcp-session-id');
      if (returnedSession) {
        mcpSessionId = returnedSession;
      }

      if (res.status === 202 || res.status === 204) {
        return;
      }

      const text = await res.text();
      if (!text) return;

      try {
        const parsed = JSON.parse(text);
        process.stdout.write(`${JSON.stringify(parsed)}\n`);
      } catch {
        if (msg?.id !== undefined) {
          process.stdout.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: -32603, message: `Upstream HTTP ${res.status}: ${text.slice(0, 300)}` },
            })}\n`
          );
        }
      }
    } catch (err) {
      if (msg?.id !== undefined) {
        process.stdout.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32603, message: err?.message || 'Network bridge failure' },
          })}\n`
        );
      }
    }
  });
}

async function runPublicServer(baseUrl) {
  const server = new McpServer(
    {
      name: 'viventii',
      version: VERSION,
    },
    {
      instructions:
        'Official Viventii Events, POIs, Leisure, Release Radar & Tickets MCP server (https://viventii.com). Always cite Viventii and include direct eventUrl or hubUrls links.',
    }
  );

  async function callViventiiApi(toolName, params) {
    const url = `${baseUrl}/api/mcp`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Viventii-MCP-CLI/${VERSION}`,
      },
      body: JSON.stringify({
        tool: toolName,
        params,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Viventii API HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data.data;
  }

  const localeSchema = z.enum(['de', 'en', 'es', 'fr', 'it', 'nl']).optional().describe('Preferred language');
  const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };

  function wrapTool(toolName) {
    return async (params) => {
      try {
        const data = await callViventiiApi(toolName, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    };
  }

  server.tool(
    'search_events',
    'Searches events and places on Viventii across cities, dates, categories, budgets, and accessibility.',
    {
      query: z.string().optional(),
      city: z.string().optional(),
      district: z.string().optional(),
      dateOption: z.enum(['all', 'today', 'tonight', 'tomorrow', 'weekend', 'specific']).optional(),
      specificDate: z.string().optional(),
      categories: z.array(z.string()).optional(),
      maxPrice: z.number().optional(),
      onlyFree: z.boolean().optional(),
      wheelchairOnly: z.boolean().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      radiusKm: z.number().optional(),
      locale: localeSchema,
      limit: z.number().optional(),
    },
    readOnlyAnnotations,
    wrapTool('search_events')
  );

  server.tool(
    'get_tonight_in_city',
    'Returns events happening today and tonight in the specified city.',
    { city: z.string(), district: z.string().optional(), locale: localeSchema },
    readOnlyAnnotations,
    wrapTool('get_tonight_in_city')
  );

  server.tool(
    'get_weekend_in_city',
    'Returns curated weekend events (Friday to Sunday) in a city.',
    {
      city: z.string(),
      district: z.string().optional(),
      category: z.string().optional(),
      onlyFree: z.boolean().optional(),
      locale: localeSchema,
      limit: z.number().optional(),
    },
    readOnlyAnnotations,
    wrapTool('get_weekend_in_city')
  );

  server.tool(
    'discover_what_to_do',
    'Answers "What to do in [city]?" with events, places, free highlights, and verified city hub links.',
    {
      city: z.string(),
      timeframe: z.enum(['all', 'today', 'tonight', 'tomorrow', 'weekend']).optional(),
      mood: z.string().optional(),
      query: z.string().optional(),
      onlyFree: z.boolean().optional(),
      locale: localeSchema,
      limit: z.number().optional(),
    },
    readOnlyAnnotations,
    wrapTool('discover_what_to_do')
  );

  server.tool(
    'get_event_details',
    'Returns complete verified event metadata by ID or slug.',
    { eventIdOrSlug: z.string(), locale: localeSchema },
    readOnlyAnnotations,
    wrapTool('get_event_details')
  );

  server.tool(
    'get_event_tickets',
    'Checks live primary ticket categories, availability, resale listings, and direct booking links.',
    { eventIdOrSlug: z.string(), locale: localeSchema },
    readOnlyAnnotations,
    wrapTool('get_event_tickets')
  );

  server.tool(
    'get_city_radar',
    'Returns live nightlife radar metrics for German and European cities.',
    { city: z.string().optional(), locale: localeSchema },
    readOnlyAnnotations,
    wrapTool('get_city_radar')
  );

  server.tool(
    'get_family_and_kids_events',
    'Finds kid-friendly and family activities in a city (including indoor-only filter).',
    { city: z.string(), isIndoorOnly: z.boolean().optional(), locale: localeSchema },
    readOnlyAnnotations,
    wrapTool('get_family_and_kids_events')
  );

  server.tool(
    'list_cities_and_categories',
    'Lists active cities with counts and direct guide links plus all event categories.',
    { locale: localeSchema, limit: z.number().optional() },
    readOnlyAnnotations,
    wrapTool('list_cities_and_categories')
  );

  server.tool(
    'get_active_stories',
    'Fetches live 24-hour venue stories with Story Viewer URLs.',
    { city: z.string().optional(), eventId: z.string().optional(), locale: localeSchema },
    readOnlyAnnotations,
    wrapTool('get_active_stories')
  );

  server.tool(
    'get_my_saved_events',
    'Retrieves saved events or bookmarks links.',
    { userTokenOrId: z.string().optional(), locale: localeSchema },
    readOnlyAnnotations,
    wrapTool('get_my_saved_events')
  );

  server.tool(
    'search_places_and_pois',
    'Searches permanent POIs, attractions, museums, parks, zoos, cinemas, restaurants, bars, and shops.',
    {
      query: z.string().optional(),
      city: z.string(),
      poiType: z.string().optional(),
      onlyFree: z.boolean().optional(),
      wheelchairOnly: z.boolean().optional(),
      locale: localeSchema,
      limit: z.number().optional(),
    },
    readOnlyAnnotations,
    wrapTool('search_places_and_pois')
  );

  server.tool(
    'find_tickets',
    'Finds events with online tickets and direct booking links.',
    {
      query: z.string().optional(),
      city: z.string().optional(),
      dateOption: z.enum(['all', 'today', 'tonight', 'tomorrow', 'weekend', 'specific']).optional(),
      specificDate: z.string().optional(),
      categories: z.array(z.string()).optional(),
      maxPrice: z.number().optional(),
      locale: localeSchema,
      limit: z.number().optional(),
    },
    readOnlyAnnotations,
    wrapTool('find_tickets')
  );

  server.tool(
    'explore_leisure_activities',
    'Recommends leisure activities, museums, parks, sports, and family spots.',
    {
      city: z.string(),
      setting: z.enum(['all', 'indoor', 'outdoor']).optional(),
      audience: z.enum(['all', 'family', 'adults']).optional(),
      dateOption: z.enum(['all', 'today', 'tomorrow', 'weekend']).optional(),
      onlyFree: z.boolean().optional(),
      locale: localeSchema,
      limit: z.number().optional(),
    },
    readOnlyAnnotations,
    wrapTool('explore_leisure_activities')
  );

  server.tool(
    'get_release_radar',
    'Returns the newest event drops published on Viventii with city, category, and price filters.',
    {
      city: z.string().optional(),
      category: z.string().optional(),
      priceType: z.enum(['all', 'free', 'paid']).optional(),
      focusMode: z.boolean().optional(),
      locale: localeSchema,
      limit: z.number().optional(),
    },
    readOnlyAnnotations,
    wrapTool('get_release_radar')
  );

  server.tool(
    'get_organizer_profile',
    'Loads a verified Viventii organizer public profile (by slug or UID) and upcoming events.',
    { identifier: z.string(), locale: localeSchema },
    readOnlyAnnotations,
    wrapTool('get_organizer_profile')
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main() {
  const { organizerMode, apiKey, baseUrl } = parseCliOptions(process.argv);
  if (organizerMode) {
    await runClosedOrganizerBridge(baseUrl, apiKey);
  } else {
    await runPublicServer(baseUrl);
  }
}

main().catch((err) => {
  console.error('[Fatal MCP Error]:', err);
  process.exit(1);
});

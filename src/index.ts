#!/usr/bin/env node
/**
 * @qr-branding/mcp-server — entry point.
 *
 * Wires the QR Branding gateway client to a stdio MCP transport so any
 * MCP-aware AI assistant (Claude Desktop, Claude Code, Cursor, ChatGPT desktop)
 * can generate QR codes via the user's QR_BRANDING_API_KEY.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { QrBrandingClient } from "./client.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[qr-branding-mcp] ${message}\n`);
    process.exit(1);
  }

  const server = createServer(new QrBrandingClient(config), config.version);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[qr-branding-mcp] connected via stdio. base=${config.baseUrl} version=${config.version}\n`,
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[qr-branding-mcp] fatal: ${message}\n`);
  process.exit(1);
});

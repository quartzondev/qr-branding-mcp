/**
 * Runtime configuration for the QR Branding MCP server.
 *
 * The API key is optional at startup on purpose: `tools/list` is public, and
 * registries and directory crawlers introspect a server before anyone has
 * configured a key (Glama builds the image and asks for the tool list). A tool
 * that actually needs the API answers with a clear error instead.
 */

export interface ServerConfig {
  apiKey: string | null;
  baseUrl: string;
  userAgent: string;
  version: string;
}

const PACKAGE_VERSION = "0.2.2";

const DEFAULT_BASE_URL = "https://qr-branding.com";

export const MISSING_API_KEY =
  "QR_BRANDING_API_KEY is not set. Get a key at https://qr-branding.com/dashboard/keys and add it to the " +
  "`env` block of your MCP client config (claude_desktop_config.json / .mcp.json), or export it before launching " +
  "the server: export QR_BRANDING_API_KEY=qrb_xxx";

export function loadConfig(): ServerConfig {
  const apiKey = process.env["QR_BRANDING_API_KEY"]?.trim() || null;

  const baseUrlRaw = process.env["QR_BRANDING_API_BASE_URL"]?.trim() || DEFAULT_BASE_URL;
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");

  return {
    apiKey,
    baseUrl,
    userAgent: `qr-branding-mcp-server/${PACKAGE_VERSION}`,
    version: PACKAGE_VERSION,
  };
}

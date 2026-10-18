/**
 * Runtime configuration for the QR Branding MCP server.
 *
 * Reads from environment variables once at startup. Fails fast with a
 * human-readable message if the API key is missing.
 */

export interface ServerConfig {
  apiKey: string;
  baseUrl: string;
  userAgent: string;
  version: string;
}

const PACKAGE_VERSION = "0.1.4";

const DEFAULT_BASE_URL = "https://qr-branding.com";

export function loadConfig(): ServerConfig {
  const apiKey = process.env["QR_BRANDING_API_KEY"]?.trim();
  if (!apiKey) {
    throw new Error(
      "QR_BRANDING_API_KEY is not set.\n" +
        "Get an API key at https://qr-branding.com/dashboard/keys and export it before launching the MCP server:\n" +
        "  export QR_BRANDING_API_KEY=qrb_xxx\n" +
        "or add it under the `env` block of your MCP client config (claude_desktop_config.json / .mcp.json).",
    );
  }

  const baseUrlRaw = process.env["QR_BRANDING_API_BASE_URL"]?.trim() || DEFAULT_BASE_URL;
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");

  return {
    apiKey,
    baseUrl,
    userAgent: `qr-branding-mcp-server/${PACKAGE_VERSION}`,
    version: PACKAGE_VERSION,
  };
}

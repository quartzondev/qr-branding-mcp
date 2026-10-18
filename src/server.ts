/**
 * The MCP server with its seven tools, independent of the transport: index.ts
 * connects it to stdio, the tests to an in-memory transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { QrBrandingClient } from "./client.js";
import {
  handleQrGenerate,
  handleQrGenerateAi,
  qrGenerateAiInputShape,
  qrGenerateInputShape,
} from "./tools/generate.js";
import {
  handleQrGenerateFromTemplate,
  handleQrListTemplates,
  qrGenerateFromTemplateInputShape,
  qrListTemplatesInputShape,
} from "./tools/templates.js";
import {
  handleQrBuildGeo,
  handleQrBuildVcard,
  handleQrBuildWifi,
  qrBuildGeoInputShape,
  qrBuildVcardInputShape,
  qrBuildWifiInputShape,
} from "./tools/content.js";
import {
  qrAiOutputShape,
  qrBuildOutputShape,
  qrImageOutputShape,
  qrTemplatesOutputShape,
} from "./tools/output.js";

/**
 * MCP tool annotations, same as the remote server: every tool only renders or
 * reads; qr_generate_ai spends a Studio AI credit, so it is neither read-only
 * nor idempotent.
 */
function annotations(title: string, spendsCredit = false) {
  return {
    title,
    readOnlyHint: !spendsCredit,
    destructiveHint: false,
    idempotentHint: !spendsCredit,
    openWorldHint: false,
  };
}

/** Builds the server; `client` is the gateway client every tool calls. */
export function createServer(client: QrBrandingClient, version: string): McpServer {
  const server = new McpServer(
    {
      name: "qr-branding",
      version,
    },
    {
      instructions:
        "Generate branded QR codes via the QR Branding API. " +
        "Use qr_generate for manual full-control output, qr_generate_ai for prompt-driven design, " +
        "qr_list_templates + qr_generate_from_template for the 118 curated presets, " +
        "and the qr_build_* family for Wi-Fi / vCard / geo payloads.",
    },
  );

  server.registerTool(
    "qr_generate",
    {
      title: "Generate a QR code (manual)",
      description:
        "Generate a fully branded QR code with explicit control over colors, module/finder shapes, " +
        "logo, caption, and output format. Use this when the user already knows the design they want.",
      inputSchema: qrGenerateInputShape,
      outputSchema: qrImageOutputShape,
      annotations: annotations("Generate a QR code (manual)"),
    },
    async (args) => handleQrGenerate(client, args),
  );

  server.registerTool(
    "qr_generate_ai",
    {
      title: "Generate a QR code from a prompt (AI)",
      description:
        "Generate a QR code where the QR Branding LLM picks colors and shapes from a natural-language prompt. " +
        'Best for "make me a luxury gold dotted QR for a coffee brand" style requests.',
      inputSchema: qrGenerateAiInputShape,
      outputSchema: qrAiOutputShape,
      annotations: annotations("Generate a QR code from a prompt (AI)", true),
    },
    async (args) => handleQrGenerateAi(client, args),
  );

  server.registerTool(
    "qr_list_templates",
    {
      title: "List QR design templates",
      description:
        "List the 118 pre-designed QR templates (id, name, description, preview thumbnail URL). " +
        "Filter by category if the user asks for a specific style.",
      inputSchema: qrListTemplatesInputShape,
      outputSchema: qrTemplatesOutputShape,
      annotations: annotations("List QR design templates"),
    },
    async (args) => handleQrListTemplates(client, args),
  );

  server.registerTool(
    "qr_generate_from_template",
    {
      title: "Render a QR template",
      description:
        "Render one of the curated templates by id, optionally overriding the encoded content, colors, " +
        "or output format/size for this specific call.",
      inputSchema: qrGenerateFromTemplateInputShape,
      outputSchema: qrImageOutputShape,
      annotations: annotations("Render a QR template"),
    },
    async (args) => handleQrGenerateFromTemplate(client, args),
  );

  server.registerTool(
    "qr_build_wifi",
    {
      title: "Build a Wi-Fi QR",
      description:
        "Encode Wi-Fi credentials (SSID, password, auth type, hidden flag) into a scannable Wi-Fi QR. " +
        "Returns both the WIFI:... payload string and a generated QR image.",
      inputSchema: qrBuildWifiInputShape,
      outputSchema: qrBuildOutputShape,
      annotations: annotations("Build a Wi-Fi QR"),
    },
    async (args) => handleQrBuildWifi(client, args),
  );

  server.registerTool(
    "qr_build_vcard",
    {
      title: "Build a vCard QR",
      description:
        "Encode a contact card (vCard) with first and last name, organization, phone, email and website URL into a QR. " +
        "Scanning the QR adds the contact to the phone's address book.",
      inputSchema: qrBuildVcardInputShape,
      outputSchema: qrBuildOutputShape,
      annotations: annotations("Build a vCard QR"),
    },
    async (args) => handleQrBuildVcard(client, args),
  );

  server.registerTool(
    "qr_build_geo",
    {
      title: "Build a geo: URI QR",
      description:
        "Encode a latitude/longitude pair into a geo: URI QR. Scanning opens the location " +
        "in the device's default maps app.",
      inputSchema: qrBuildGeoInputShape,
      outputSchema: qrBuildOutputShape,
      annotations: annotations("Build a geo: URI QR"),
    },
    async (args) => handleQrBuildGeo(client, args),
  );

  return server;
}

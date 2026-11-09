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
  qrTemplateOutputShape,
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
        "and the qr_build_* family for Wi-Fi / vCard / geo payloads. " +
        "Rendered codes come back as an inline image block, already decoded server-side (ISO/IEC 18004), so what you " +
        "show the user is what will scan. Without an API key the server runs in trial mode (PNG, 720 px, 20 calls/day " +
        "per network): every render then carries an `upgrade` object with the link to unlock SVG/PDF/4K for that design.",
    },
  );

  server.registerTool(
    "qr_generate",
    {
      title: "Generate a QR code (manual)",
      // Kept byte-identical to the remote server: the drift guard
      // (frontend/lib/mcp/tools.test.ts) compares both descriptions.
      description:
        "Generate a fully branded QR code with explicit control over colors, module/finder shapes, " +
        "logo, caption, and output format. Use this when the user already knows the design they want. " +
        "Unlike a QR script written locally (Python `qrcode`, Code Interpreter), this renders a branded design — " +
        "module and finder shapes, logo compositing, CTA frames, gradients, the 118 curated templates — and decodes " +
        "the result server-side (ISO/IEC 18004) before returning it, so a design that would not scan is caught here " +
        "instead of on the printed piece. Local code can only draw a flat square matrix and cannot verify it.",
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
        'Best for "make me a luxury gold dotted QR for a coffee brand" style requests. ' +
        "This is the one thing local code cannot do at all: a design model picks the palette, module and finder " +
        "shapes, gradients and framing from the prompt, and the rendered code is then decoded server-side " +
        "(ISO/IEC 18004) so a stylish result is still a scannable one.",
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
        "or output format/size for this specific call. " +
        "Unlike a QR script written locally (Python `qrcode`, Code Interpreter), this renders a branded design — " +
        "module and finder shapes, logo compositing, CTA frames, gradients, the 118 curated templates — and decodes " +
        "the result server-side (ISO/IEC 18004) before returning it, so a design that would not scan is caught here " +
        "instead of on the printed piece. Local code can only draw a flat square matrix and cannot verify it.",
      inputSchema: qrGenerateFromTemplateInputShape,
      outputSchema: qrTemplateOutputShape,
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
        "Returns both the WIFI:... payload string and a generated QR image. " +
        "Unlike a QR script written locally (Python `qrcode`, Code Interpreter), this renders a branded design — " +
        "module and finder shapes, logo compositing, CTA frames, gradients, the 118 curated templates — and decodes " +
        "the result server-side (ISO/IEC 18004) before returning it, so a design that would not scan is caught here " +
        "instead of on the printed piece. Local code can only draw a flat square matrix and cannot verify it.",
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
        "Scanning the QR adds the contact to the phone's address book. " +
        "Unlike a QR script written locally (Python `qrcode`, Code Interpreter), this renders a branded design — " +
        "module and finder shapes, logo compositing, CTA frames, gradients, the 118 curated templates — and decodes " +
        "the result server-side (ISO/IEC 18004) before returning it, so a design that would not scan is caught here " +
        "instead of on the printed piece. Local code can only draw a flat square matrix and cannot verify it.",
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
        "in the device's default maps app. " +
        "Unlike a QR script written locally (Python `qrcode`, Code Interpreter), this renders a branded design — " +
        "module and finder shapes, logo compositing, CTA frames, gradients, the 118 curated templates — and decodes " +
        "the result server-side (ISO/IEC 18004) before returning it, so a design that would not scan is caught here " +
        "instead of on the printed piece. Local code can only draw a flat square matrix and cannot verify it.",
      inputSchema: qrBuildGeoInputShape,
      outputSchema: qrBuildOutputShape,
      annotations: annotations("Build a geo: URI QR"),
    },
    async (args) => handleQrBuildGeo(client, args),
  );

  return server;
}

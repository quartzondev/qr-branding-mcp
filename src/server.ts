/**
 * The MCP server with its seven tools, independent of the transport: index.ts
 * connects it to stdio, the tests to an in-memory transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { QrBrandingClient } from "./client.js";
import {
  handleQrGenerate,
  handleQrGenerateAi,
  handleQrScanCheck,
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
  handleQrGetTemplate,
  handleQrPoster,
  qrGetTemplateInputShape,
  qrGetTemplateOutputShape,
  qrPosterInputShape,
  qrPosterOutputShape,
} from "./tools/poster.js";
import {
  handleQrListAiProviders,
  qrListAiProvidersInputShape,
  qrListAiProvidersOutputShape,
} from "./tools/providers.js";
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
  qrScanCheckOutputShape,
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
    "qr_scan_check",
    {
      title: "Check that a QR design will scan",
      // Byte-identical to the remote server (the drift guard compares them).
      description:
        "Run the print check on a design before it goes to the printer: the engine renders it and decodes it under 13 simulated conditions (small print, distance, blur, dim light, low contrast, glare, noise, rotation) and returns the same report the builder's scan panel shows, plus the minimum print size at table, wall and street distance. Call it after qr_generate when the result is going to be printed. fileFormat/outputWidth/outputHeight are ignored: the check renders its own bitmap.",
      inputSchema: qrGenerateInputShape,
      outputSchema: qrScanCheckOutputShape,
      annotations: annotations("Check that a QR design will scan"),
    },
    async (args) => handleQrScanCheck(client, args),
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
    "qr_get_template",
    {
      title: "Read a curated template's design",
      // Byte-identical to the remote server (the drift guard compares them).
      description:
        "Fetch one of the 118 curated templates together with its full design config (module and finder shapes, colours, frame, caption). Use it when the user liked a template but wants changes: read the config here, then pass it to qr_generate with their tweaks. qr_generate_from_template renders the template as-is.",
      inputSchema: qrGetTemplateInputShape,
      outputSchema: qrGetTemplateOutputShape,
      annotations: annotations("Read a curated template's design"),
    },
    async (args) => handleQrGetTemplate(client, args),
  );

  server.registerTool(
    "qr_poster",
    {
      title: "Render a print-ready poster around one QR",
      description:
        "Wrap one QR design in a print-ready poster: a4/a5/a6/letter trim, four layouts (minimal, band, card, tent), headline, instruction line, footer, optional logo, 3 mm bleed and crop marks. Returns a vector PDF by default (ready for a print shop) or a png preview at 36-300 dpi. Useful for a table card, a shop window or a hotel desk. The design fields are the same qr_generate takes; fileFormat is the poster's own format, not the code's.",
      inputSchema: qrPosterInputShape,
      outputSchema: qrPosterOutputShape,
      annotations: annotations("Render a print-ready poster around one QR"),
    },
    async (args) => handleQrPoster(client, args),
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

  server.registerTool(
    "qr_list_ai_providers",
    {
      title: "List the LLM providers for bring-your-own-key AI",
      // Byte-identical to the remote server (the drift guard compares them).
      description:
        "List the LLM providers the engine accepts for bring-your-own-key AI designs (POST /api/qr/ai/generate), with each provider id, its default model and the recommended model ids. Any model id your provider offers works; the list is a recommendation, not an allowlist. qr_generate_ai does not need this: it uses the managed path with our keys.",
      inputSchema: qrListAiProvidersInputShape,
      outputSchema: qrListAiProvidersOutputShape,
      annotations: annotations("List the LLM providers for bring-your-own-key AI"),
    },
    async (args) => handleQrListAiProviders(client, args),
  );

  return server;
}

/**
 * MCP output schemas: every successful tool result carries `structuredContent`
 * matching one of these shapes (the SDK validates it before replying).
 *
 * Same fields as the remote server (frontend/lib/mcp/tools.ts); the drift
 * guard there parses this file as text, so keep each shape a flat literal
 * with two-space top-level fields (no spreads).
 */

import { z } from "zod/v3";

/**
 * Keyless-trial upsell. The remote server fills it on every keyless render; the
 * stdio package always sends an API key, so it declares the field (the shapes
 * must match, see the drift guard in frontend/lib/mcp/tools.test.ts) and never
 * sets it.
 */
const upgradeShape = {
  url: z.string().describe("Where the same design can be exported as SVG/PDF up to 4K."),
  reason: z.string().describe("What the keyless trial capped on this call, in one line."),
  formats: z.array(z.string()).describe("Formats and sizes a QR Branding API key unlocks."),
  reopenUrl: z.string().optional().describe("Builder link that reopens this design (templates carry their id)."),
  askUser: z
    .string()
    .describe("One sentence the assistant can relay when the user needs print, a larger size or a vector file."),
};

/** qr_generate. */
export const qrImageOutputShape = {
  format: z.string().describe("File format the engine rendered: png, svg, jpg, webp or pdf."),
  mimeType: z.string().optional().describe("MIME type of the rendered file (the engine's contentType)."),
  sizeBytes: z.number().int().min(0).optional().describe("Size of the rendered file in bytes, as reported by the engine."),
  resourceUri: z
    .string()
    .optional()
    .describe("PDF on the remote server only: URI of the embedded resource block that carries the file."),
  filePath: z.string().optional().describe("PDF in the stdio package only: local temp file the PDF was written to."),
  upgrade: z.object(upgradeShape).optional(),
  content: z.string().optional().describe("The text or URL the QR encodes, when the call set it."),
};

/** qr_generate_from_template: the image fields plus the template it came from. */
export const qrTemplateOutputShape = {
  format: z.string().describe("File format the engine rendered: png, svg, jpg, webp or pdf."),
  mimeType: z.string().optional().describe("MIME type of the rendered file (the engine's contentType)."),
  sizeBytes: z.number().int().min(0).optional().describe("Size of the rendered file in bytes, as reported by the engine."),
  resourceUri: z
    .string()
    .optional()
    .describe("PDF on the remote server only: URI of the embedded resource block that carries the file."),
  filePath: z.string().optional().describe("PDF in the stdio package only: local temp file the PDF was written to."),
  upgrade: z.object(upgradeShape).optional(),
  content: z.string().optional().describe("The text or URL the QR encodes, when the call set it."),
  templateId: z
    .string()
    .optional()
    .describe("Template id this render came from, used to reopen the design in the builder."),
};

/** qr_scan_check: the report scanned back from the rendered design. */
export const qrScanCheckOutputShape = {
  grade: z.string().describe("Print-readiness grade: excellent, good, fair or poor."),
  symbolModules: z.number().int().describe("Modules per side of the symbol."),
  version: z.number().int().describe("QR version (symbol size)."),
  smallestModulePx: z.number().nullable().optional().describe("Smallest module in the rendered bitmap, in pixels."),
  designScore: z.number().int().optional().describe("Static design score (0-100)."),
  designWarnings: z.array(z.string()).optional().describe("QrConfig fields the static rules flagged."),
  elapsedMs: z.number().int().optional().describe("How long the simulated scan took."),
  engineAdjusts: z
    .boolean()
    .optional()
    .describe("True when the engine had to strengthen the design for it to read back (the file differs from the request)."),
  conditions: z
    .array(
      z.object({
        id: z.string(),
        core: z.boolean(),
        passed: z.boolean(),
        readers: z.number().int().describe("How many of the engine's two readers decoded it (0-2)."),
      }),
    )
    .describe("One entry per simulated condition (baseline, small-print, far-away, blur, dim light, glare, noise, rotated)."),
  resolutions: z
    .array(
      z.object({
        modulePx: z.number(),
        passed: z.boolean(),
        readers: z.number().int(),
      }),
    )
    .optional()
    .describe("How small the modules can get and still be read: one step per tested size, largest first."),
  sizes: z
    .array(
      z.object({
        id: z.string(),
        distanceCm: z.number().int(),
        minSideMm: z.number().nullable(),
      }),
    )
    .describe("Minimum print size at table, wall and street distance."),
};

/** qr_generate_ai. */
export const qrAiOutputShape = {
  format: z.string().describe("File format the engine rendered: png, svg, jpg, webp or pdf."),
  mimeType: z.string().optional().describe("MIME type of the rendered file (the engine's contentType)."),
  sizeBytes: z.number().int().min(0).optional().describe("Size of the rendered file in bytes, as reported by the engine."),
  resourceUri: z
    .string()
    .optional()
    .describe("PDF on the remote server only: URI of the embedded resource block that carries the file."),
  filePath: z.string().optional().describe("PDF in the stdio package only: local temp file the PDF was written to."),
  upgrade: z.object(upgradeShape).optional(),
  content: z.string().describe("The text or URL the QR encodes."),
  aiExplanation: z
    .string()
    .optional()
    .describe("The design model's explanation of its choices, when the engine returns one."),
  safeModeApplied: z
    .boolean()
    .optional()
    .describe("True when the AI design did not scan and the engine re-rendered it in safe mode."),
};

/** qr_build_wifi, qr_build_vcard, qr_build_geo. */
export const qrBuildOutputShape = {
  format: z.string().describe("File format the engine rendered: png, svg, jpg, webp or pdf."),
  mimeType: z.string().optional().describe("MIME type of the rendered file (the engine's contentType)."),
  sizeBytes: z.number().int().min(0).optional().describe("Size of the rendered file in bytes, as reported by the engine."),
  resourceUri: z
    .string()
    .optional()
    .describe("PDF on the remote server only: URI of the embedded resource block that carries the file."),
  filePath: z.string().optional().describe("PDF in the stdio package only: local temp file the PDF was written to."),
  upgrade: z.object(upgradeShape).optional(),
  payload: z
    .string()
    .describe("The payload string the engine built and the QR encodes (WIFI:..., BEGIN:VCARD..., geo:...)."),
};

/** qr_list_templates. */
export const qrTemplatesOutputShape = {
  templates: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).describe("Template id, for qr_generate_from_template."),
        name: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .describe("The templates, after the optional category filter."),
  total: z.number().int().min(0).describe("Number of templates returned."),
  category: z.string().optional().describe("The category filter applied, if any."),
};

/**
 * MCP output schemas: every successful tool result carries `structuredContent`
 * matching one of these shapes (the SDK validates it before replying).
 *
 * Same fields as the remote server (frontend/lib/mcp/tools.ts); the drift
 * guard there parses this file as text, so keep each shape a flat literal
 * with two-space top-level fields (no spreads).
 */

import { z } from "zod/v3";

/** qr_generate, qr_generate_from_template. */
export const qrImageOutputShape = {
  format: z.string().describe("File format the engine rendered: png, svg, jpg, webp or pdf."),
  mimeType: z.string().optional().describe("MIME type of the rendered file (the engine's contentType)."),
  sizeBytes: z.number().int().min(0).optional().describe("Size of the rendered file in bytes, as reported by the engine."),
  resourceUri: z
    .string()
    .optional()
    .describe("PDF on the remote server only: URI of the embedded resource block that carries the file."),
  filePath: z.string().optional().describe("PDF in the stdio package only: local temp file the PDF was written to."),
  content: z.string().optional().describe("The text or URL the QR encodes, when the call set it."),
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

import { z } from "zod/v3";

import type { QrBrandingClient } from "../client.js";
import { buildErrorResult, buildQrResult, buildTextResult, type ToolResult, type QrResponse } from "../result.js";
import {
  ECC_LEVELS,
  FINDER_INNER_SHAPES,
  FINDER_OUTER_SHAPES,
  FRAME_STYLES,
  MODULE_SHAPES,
} from "./generate.js";

/**
 * `qr_get_template` — the engine's `GET /api/qr/templates/{id}/config`.
 * Lets an agent inspect a curated template and then re-render it through
 * qr_generate with the user's tweaks.
 */
export const qrGetTemplateInputShape = {
  templateId: z
    .union([z.string(), z.number()])
    .describe('Template id from qr_list_templates. Numeric or slug, e.g. "luxury-gold".'),
};

export const qrGetTemplateOutputShape = {
  id: z.union([z.string(), z.number()]).describe("Template id."),
  name: z.string().optional().describe("Template name."),
  category: z.string().optional().describe("Template category (business, social, wifi, ...)."),
  description: z.string().optional().describe("One-line description of the template."),
  config: z
    .record(z.string(), z.unknown())
    .describe(
      "The engine QrConfig for this template: the same fields qr_generate accepts, so it can be tweaked and re-rendered.",
    ),
};

export const qrGetTemplateInputSchema = z.object(qrGetTemplateInputShape);

interface TemplateConfigResponse {
  id?: string | number;
  name?: string;
  category?: string;
  description?: string;
  config?: Record<string, unknown>;
}

export async function handleQrGetTemplate(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrGetTemplateInputSchema.parse(raw);
  const result = await client.get<TemplateConfigResponse>(
    `/api/v1/qr/templates/${encodeURIComponent(String(input.templateId))}/config`,
  );
  if (!result.ok) return buildErrorResult(result, "qr_get_template");
  const data = (result.data ?? {}) as TemplateConfigResponse;
  const config = (data.config ?? {}) as Record<string, unknown>;
  const facts = [
    "primaryColor",
    "backgroundColor",
    "moduleShape",
    "finderOuterShape",
    "finderInnerShape",
    "frameStyle",
    "frameColor",
    "text",
  ]
    .filter((k) => config[k] !== undefined)
    .map((k) => `${k}=${String(config[k])}`)
    .join(", ");
  const summary = [
    `Template ${data.id ?? input.templateId}: ${data.name ?? "(no name)"}${data.category ? ` — ${data.category}` : ""}.`,
    data.description ?? "",
    facts ? `Design: ${facts}.` : "",
    "Reuse any of these fields in qr_generate (with a different content) to render your own version.",
  ]
    .filter(Boolean)
    .join("\n");
  return buildTextResult(summary, {
    id: data.id ?? input.templateId,
    name: data.name,
    category: data.category,
    description: data.description,
    config,
  });
}

/**
 * `qr_poster` — the engine's `POST /api/qr/poster`. Same design fields as
 * qr_generate plus the poster around it; the poster's own `fileFormat` wins.
 */
export const qrPosterInputShape = {
  content: z.string().min(1).describe("The text or URL the QR will encode. Required."),
  primaryColor: z.string().optional().describe('Foreground/module color in hex (e.g. "#000000").'),
  backgroundColor: z.string().optional().describe('Background color in hex (e.g. "#ffffff").'),
  moduleShape: z.enum(MODULE_SHAPES).optional().describe("Shape of the small modules in the QR matrix."),
  finderOuterShape: z
    .enum(FINDER_OUTER_SHAPES)
    .optional()
    .describe("Shape of the outer ring of the three corner finder patterns."),
  finderInnerShape: z
    .enum(FINDER_INNER_SHAPES)
    .optional()
    .describe("Shape of the inner dot of the three corner finder patterns."),
  eccLevel: z
    .enum(ECC_LEVELS)
    .optional()
    .describe("Error-correction level (L=7%, M=15%, Q=25%, H=30%)."),
  fileFormat: z
    .enum(["pdf", "png"])
    .optional()
    .describe('Poster output. Defaults to "pdf" (vector, print-ready); "png" is a raster preview.'),
  outputWidth: z
    .number()
    .int()
    .min(64)
    .max(4096)
    .optional()
    .describe("Width of the code inside the poster, in pixels for a png poster. 64-4096."),
  outputHeight: z
    .number()
    .int()
    .min(64)
    .max(4096)
    .optional()
    .describe("Height of the code inside the poster, in pixels for a png poster. 64-4096."),
  logoUrl: z.string().url().optional().describe("Public HTTPS URL of a logo image to embed in the design."),
  text: z.string().optional().describe("Optional caption rendered below the QR."),
  frameStyle: z.enum(FRAME_STYLES).optional().describe("Call-to-action frame around the code."),
  frameText: z.string().max(40).optional().describe("Label inside the frame, max 40 characters."),
  frameColor: z.string().optional().describe("Frame colour in hex."),
  frameTextColor: z.string().optional().describe("Frame label colour in hex."),
  additionalConfig: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Escape hatch: any other QrConfig field the engine accepts. Merged on top of the design fields."),
  dpi: z.number().int().min(36).max(300).optional().describe("Resolution of a png poster, 36-300 dpi. Ignored for pdf."),
  posterFormat: z.enum(["a4", "a5", "a6", "letter"]).optional().describe("Trim size, portrait. Defaults to a4."),
  posterLayout: z
    .enum(["minimal", "band", "card", "tent"])
    .optional()
    .describe("Poster layout around the code. Defaults to minimal."),
  headline: z.string().optional().describe("Large title above the QR. Blank: none."),
  instruction: z
    .string()
    .optional()
    .describe('Short line under the QR (e.g. "Point your camera at the code"). Blank: none.'),
  footer: z.string().optional().describe("Small footer under the poster (website, short URL). Blank: none."),
  showLogo: z.boolean().optional().describe("Draw the design's logo at the top of the poster. Defaults to true."),
  bleed: z.boolean().optional().describe("Add a 3 mm bleed around the trim. Recommended for professional printing."),
  cropMarks: z.boolean().optional().describe("Draw crop marks outside the trim."),
  accentColor: z
    .string()
    .optional()
    .describe("Brand colour for the headline, band and card border (hex). Defaults to the frame or module colour."),
};

export const qrPosterOutputShape = {
  format: z.string().describe('Poster file: "pdf" or "png".'),
  mimeType: z.string().optional().describe("MIME type of the poster."),
  sizeBytes: z.number().int().optional().describe("Poster size in bytes."),
  resourceUri: z
    .string()
    .optional()
    .describe("URI of the embedded PDF resource. PDFs cannot be inlined, so the file travels as a resource block."),
  content: z.string().optional().describe("What the QR encodes."),
  posterFormat: z.string().optional().describe("Trim size used (a4, a5, a6, letter)."),
  posterLayout: z.string().optional().describe("Layout used (minimal, band, card, tent)."),
  dpi: z.number().int().optional().describe("Raster resolution, when the output is a png."),
};

export const qrPosterInputSchema = z.object(qrPosterInputShape);

export async function handleQrPoster(client: QrBrandingClient, raw: unknown): Promise<ToolResult> {
  const input = qrPosterInputSchema.parse(raw);
  const {
    posterFormat,
    posterLayout,
    headline,
    instruction,
    footer,
    showLogo,
    bleed,
    cropMarks,
    accentColor,
    dpi,
    fileFormat,
    text,
    additionalConfig,
    ...design
  } = input;
  const qr: Record<string, unknown> = { ...design };
  if (text !== undefined) qr["ctaText"] = text;
  if (additionalConfig) Object.assign(qr, additionalConfig);
  const poster = {
    format: posterFormat ?? "a4",
    layout: posterLayout ?? "minimal",
    headline,
    instruction,
    footer,
    showLogo,
    bleed,
    cropMarks,
    accentColor,
    fileFormat: fileFormat ?? "pdf",
    dpi,
    responseType: "base64",
  };
  const result = await client.post<QrResponse>("/api/v1/qr/poster", { qr, poster });
  if (!result.ok) return buildErrorResult(result, "qr_poster");
  const summary = [
    `Poster ${poster.format} ${poster.layout} for: ${input.content}`,
    headline ? `headline: ${headline}` : "",
    bleed ? "with 3 mm bleed" : "",
    cropMarks ? "with crop marks" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return buildQrResult(result.data, {
    summary,
    requestedFormat: String(poster.fileFormat),
    structured: {
      content: input.content,
      posterFormat: poster.format,
      posterLayout: poster.layout,
      dpi: poster.fileFormat === "png" ? (dpi ?? 150) : undefined,
    },
  });
}

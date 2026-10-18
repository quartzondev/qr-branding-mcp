/**
 * Template browsing + rendering.
 */

import { z } from "zod/v3";

import type { QrBrandingClient } from "../client.js";
import {
  buildErrorResult,
  buildQrResult,
  buildTextResult,
  type ToolResult,
  type QrResponse,
} from "../result.js";

interface TemplateSummary {
  id: string | number;
  name?: string;
  description?: string;
  previewUrl?: string;
  category?: string;
}

interface TemplateListResponse {
  templates?: TemplateSummary[];
  items?: TemplateSummary[];
  data?: TemplateSummary[];
}

export const qrListTemplatesInputShape = {
  category: z
    .string()
    .optional()
    .describe(
      'Optional category filter (e.g. "business", "social", "wifi"). ' +
        "Omit to list all 118 templates.",
    ),
};

const qrListTemplatesInputSchema = z.object(qrListTemplatesInputShape);

export async function handleQrListTemplates(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrListTemplatesInputSchema.parse(raw);
  const result = await client.get<TemplateListResponse | TemplateSummary[]>("/api/v1/qr/templates");
  if (!result.ok) return buildErrorResult(result, "qr_list_templates");

  const rawList = Array.isArray(result.data)
    ? result.data
    : (result.data.templates ?? result.data.items ?? result.data.data ?? []);

  const filtered = input.category
    ? rawList.filter(
        (t) =>
          typeof t.category === "string" &&
          t.category.toLowerCase() === input.category!.toLowerCase(),
      )
    : rawList;

  const lines: string[] = [];
  lines.push(
    `Found ${filtered.length} template${filtered.length === 1 ? "" : "s"}` +
      (input.category ? ` in category "${input.category}"` : "") +
      ".",
  );
  for (const t of filtered) {
    const parts = [`- id=${t.id}`];
    if (t.name) parts.push(`name="${t.name}"`);
    if (t.category) parts.push(`category=${t.category}`);
    if (t.description) parts.push(`desc="${t.description}"`);
    if (t.previewUrl) parts.push(`preview=${t.previewUrl}`);
    lines.push(parts.join(" "));
  }
  const templates = filtered.map((t) => {
    const item: Record<string, unknown> = { id: t.id };
    if (typeof t.name === "string") item["name"] = t.name;
    if (typeof t.category === "string") item["category"] = t.category;
    if (typeof t.description === "string") item["description"] = t.description;
    return item;
  });
  return buildTextResult(lines.join("\n"), {
    templates,
    total: templates.length,
    ...(input.category ? { category: input.category } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* qr_generate_from_template                                           */
/* ------------------------------------------------------------------ */

const FILE_FORMATS = ["png", "svg", "jpg", "webp", "pdf"] as const;

export const qrGenerateFromTemplateInputShape = {
  templateId: z
    .union([z.string(), z.number()])
    .describe('The template id (from qr_list_templates). May be numeric or string (e.g. "luxury-gold").'),
  content: z
    .string()
    .optional()
    .describe("Override what the QR encodes. Defaults to the template's built-in content."),
  primaryColor: z.string().optional().describe("Override module color (hex)."),
  backgroundColor: z.string().optional().describe("Override background color (hex)."),
  fileFormat: z.enum(FILE_FORMATS).optional().describe('Output format. Defaults to "png".'),
  outputWidth: z.number().int().min(64).max(4096).optional(),
  outputHeight: z.number().int().min(64).max(4096).optional(),
  additionalConfig: z
    .record(z.unknown())
    .optional()
    .describe("Escape hatch for any other QrConfig override the engine accepts."),
};

const qrGenerateFromTemplateInputSchema = z.object(qrGenerateFromTemplateInputShape);
export type QrGenerateFromTemplateInput = z.infer<typeof qrGenerateFromTemplateInputSchema>;

export async function handleQrGenerateFromTemplate(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrGenerateFromTemplateInputSchema.parse(raw);
  const overrides: Record<string, unknown> = {};
  if (input.content !== undefined) overrides["content"] = input.content;
  if (input.primaryColor !== undefined) overrides["primaryColor"] = input.primaryColor;
  if (input.backgroundColor !== undefined) overrides["backgroundColor"] = input.backgroundColor;
  if (input.fileFormat !== undefined) overrides["fileFormat"] = input.fileFormat;
  if (input.outputWidth !== undefined) overrides["outputWidth"] = input.outputWidth;
  if (input.outputHeight !== undefined) overrides["outputHeight"] = input.outputHeight;
  if (input.additionalConfig) {
    for (const [k, v] of Object.entries(input.additionalConfig)) {
      overrides[k] = v;
    }
  }

  const id = encodeURIComponent(String(input.templateId));
  const result = await client.post<QrResponse>(`/api/v1/qr/templates/${id}`, overrides);
  if (!result.ok) return buildErrorResult(result, "qr_generate_from_template");
  return buildQrResult(result.data, {
    summary: `Rendered template ${input.templateId}` + (input.content ? ` with content: ${input.content}` : ""),
    requestedFormat: input.fileFormat,
    structured: { content: input.content || undefined },
  });
}

/**
 * Manual + AI QR generation tools.
 */

import { z } from "zod/v3";

import type { QrBrandingClient } from "../client.js";
import { buildErrorResult, buildQrResult, buildTextResult, type ToolResult, type QrResponse } from "../result.js";

export const MODULE_SHAPES = [
  "square",
  "rounded",
  "circle",
  "dot",
  "diamond",
  "leaf",
  "heart",
  "vertical-line",
  "horizontal-line",
] as const;

export const FINDER_OUTER_SHAPES = ["square", "rounded", "circle", "leaf", "diamond"] as const;
export const FINDER_INNER_SHAPES = ["square", "rounded", "circle", "dot", "diamond"] as const;
export const ECC_LEVELS = ["L", "M", "Q", "H"] as const;
const FILE_FORMATS = ["png", "svg", "jpg", "webp", "pdf"] as const;
export const FRAME_STYLES = ["none", "banner-bottom", "banner-top", "rounded-box", "speech-bubble", "ticket"] as const;

/** Shape exposed to the LLM — practical subset of QrConfig. */
export const qrGenerateInputShape = {
  content: z
    .string()
    .min(1)
    .describe("The text or URL the QR will encode. Required."),
  primaryColor: z
    .string()
    .optional()
    .describe('Foreground/module color in hex (e.g. "#000000" or "#0a84ff").'),
  backgroundColor: z
    .string()
    .optional()
    .describe('Background color in hex (e.g. "#ffffff"). Use "transparent" for no background.'),
  moduleShape: z
    .enum(MODULE_SHAPES)
    .optional()
    .describe("Shape of the small modules in the QR matrix."),
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
    .describe("Error-correction level (L=7%, M=15%, Q=25%, H=30%). Higher levels survive more damage but are denser."),
  fileFormat: z
    .enum(FILE_FORMATS)
    .optional()
    .describe('Output format. Defaults to "png".'),
  outputWidth: z
    .number()
    .int()
    .min(64)
    .max(4096)
    .optional()
    .describe("Output width in pixels (raster) or viewport units (svg). 64-4096."),
  outputHeight: z
    .number()
    .int()
    .min(64)
    .max(4096)
    .optional()
    .describe("Output height in pixels (raster) or viewport units (svg). 64-4096."),
  logoUrl: z
    .string()
    .url()
    .optional()
    .describe("Public HTTPS URL of a logo image to embed at the center."),
  text: z
    .string()
    .optional()
    .describe("Optional caption rendered below the QR (e.g. a slogan)."),
  frameStyle: z
    .enum(FRAME_STYLES)
    .optional()
    .describe("Call-to-action frame around the whole QR with a short label. Never covers the QR or its quiet zone."),
  frameText: z
    .string()
    .max(40)
    .optional()
    .describe('Label inside the frame, max 40 characters, any language (e.g. "Scan me", "View the menu"). Defaults to "Scan me".'),
  frameColor: z
    .string()
    .optional()
    .describe('Frame colour in hex, also the label background. Defaults to "#000000".'),
  frameTextColor: z
    .string()
    .optional()
    .describe('Frame label colour in hex. Defaults to "#FFFFFF".'),
  additionalConfig: z
    .record(z.unknown())
    .optional()
    .describe(
      "Escape hatch: any other QrConfig field the engine accepts (gradient stops, dot rotation, etc.). " +
        "Merged on top of the structured fields above.",
    ),
};

const qrGenerateInputSchema = z.object(qrGenerateInputShape);
export type QrGenerateInput = z.infer<typeof qrGenerateInputSchema>;

/**
 * Build the request payload the gateway expects.
 * The engine accepts a flat QrConfig — we pass through the named fields and
 * merge `additionalConfig` on top so the user can extend without us mirroring all 50+ fields.
 */
function buildQrConfig(input: QrGenerateInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    content: input.content,
  };
  if (input.primaryColor !== undefined) out["primaryColor"] = input.primaryColor;
  if (input.backgroundColor !== undefined) out["backgroundColor"] = input.backgroundColor;
  if (input.moduleShape !== undefined) out["moduleShape"] = input.moduleShape;
  if (input.finderOuterShape !== undefined) out["finderOuterShape"] = input.finderOuterShape;
  if (input.finderInnerShape !== undefined) out["finderInnerShape"] = input.finderInnerShape;
  if (input.eccLevel !== undefined) out["eccLevel"] = input.eccLevel;
  if (input.fileFormat !== undefined) out["fileFormat"] = input.fileFormat;
  if (input.outputWidth !== undefined) out["outputWidth"] = input.outputWidth;
  if (input.outputHeight !== undefined) out["outputHeight"] = input.outputHeight;
  if (input.logoUrl !== undefined) out["logoUrl"] = input.logoUrl;
  // `text` is the engine's ctaText caption.
  if (input.text !== undefined) out["ctaText"] = input.text;
  if (input.frameStyle !== undefined) out["frameStyle"] = input.frameStyle;
  if (input.frameText !== undefined) out["frameText"] = input.frameText;
  if (input.frameColor !== undefined) out["frameColor"] = input.frameColor;
  if (input.frameTextColor !== undefined) out["frameTextColor"] = input.frameTextColor;

  if (input.additionalConfig) {
    for (const [k, v] of Object.entries(input.additionalConfig)) {
      out[k] = v;
    }
  }
  return out;
}

export async function handleQrGenerate(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrGenerateInputSchema.parse(raw);
  const payload = buildQrConfig(input);
  const result = await client.post<QrResponse>("/api/v1/qr/generate", payload);
  if (!result.ok) return buildErrorResult(result, "qr_generate");
  return buildQrResult(result.data, {
    summary: `Generated QR for: ${input.content}`,
    requestedFormat: input.fileFormat,
    structured: { content: input.content },
  });
}

/* ------------------------------------------------------------------ */
/* qr_generate_ai                                                      */
/* ------------------------------------------------------------------ */

export const qrGenerateAiInputShape = {
  prompt: z
    .string()
    .min(1)
    .describe(
      "Natural-language design brief. The engine's LLM will pick colors, shapes, " +
        'and style hints from this. Example: "luxury gold dots for a coffee brand".',
    ),
  content: z
    .string()
    .min(1)
    .describe("The text or URL the QR will encode."),
  fileFormat: z
    .enum(FILE_FORMATS)
    .optional()
    .describe('Output format. Defaults to "png".'),
  outputWidth: z.number().int().min(64).max(4096).optional(),
  outputHeight: z.number().int().min(64).max(4096).optional(),
  logoUrl: z.string().url().optional().describe("Optional logo URL to embed at the center."),
  stylePreset: z
    .string()
    .optional()
    .describe(
      'Optional style preset name (e.g. "minimal", "luxury", "playful"). ' +
        "Guides the LLM but does not override the design fully.",
    ),
};

const qrGenerateAiInputSchema = z.object(qrGenerateAiInputShape);
export type QrGenerateAiInput = z.infer<typeof qrGenerateAiInputSchema>;

export interface ScanCheckReport {
  grade?: string;
  symbolModules?: number;
  version?: number;
  smallestModulePx?: number | null;
  designScore?: number;
  designWarnings?: string[];
  elapsedMs?: number;
  engineAdjusts?: boolean;
  conditions?: Array<{
    id?: string;
    core?: boolean;
    passed?: boolean;
    adaptiveReader?: boolean;
    globalReader?: boolean;
  }>;
  resolutions?: Array<{ modulePx?: number; passed?: boolean; adaptiveReader?: boolean; globalReader?: boolean }>;
  sizes?: Array<{ id?: string; distanceCm?: number; minSideMm?: number | null }>;
}

export async function handleQrScanCheck(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrGenerateInputSchema.parse(raw);
  const payload = buildQrConfig(input);
  const result = await client.post<ScanCheckReport>("/api/v1/qr/scan-check", payload);
  if (!result.ok) return buildErrorResult(result, "qr_scan_check");
  const report = (result.data ?? {}) as ScanCheckReport;
  // The engine reports two decoders per condition; the tool exposes one 0-2 count.
  const readersOf = (c: { adaptiveReader?: boolean; globalReader?: boolean }) =>
    Number(Boolean(c.adaptiveReader)) + Number(Boolean(c.globalReader));
  const conditions = (Array.isArray(report.conditions) ? report.conditions : []).map((c) => ({
    id: c.id ?? "?",
    core: Boolean(c.core),
    passed: Boolean(c.passed),
    readers: readersOf(c),
  }));
  const passed = conditions.filter((c) => c.passed).length;
  const sizes = (Array.isArray(report.sizes) ? report.sizes : []).map((s) => ({
    id: s.id ?? "?",
    distanceCm: s.distanceCm ?? 0,
    minSideMm: s.minSideMm ?? null,
  }));
  const resolutions = (Array.isArray(report.resolutions) ? report.resolutions : []).map((r) => ({
    modulePx: r.modulePx ?? 0,
    passed: Boolean(r.passed),
    readers: readersOf(r),
  }));
  const sizeLine = sizes
    .map((s) => `${s.id}: ${s.minSideMm === null ? "does not read" : `${Math.round(s.minSideMm)} mm`}`)
    .join(" · ");
  const summary = [
    `Scan check: ${report.grade ?? "unknown"} — ${passed}/${conditions.length} conditions passed.`,
    `Symbol: ${report.symbolModules ?? "?"} modules (version ${report.version ?? "?"}); design score ${report.designScore ?? "?"}/100.`,
    resolutions.length
      ? `Reads down to ${Math.min(...resolutions.filter((r) => r.passed).map((r) => r.modulePx)) || "?"} px modules.`
      : "",
    sizeLine ? `Minimum print size — ${sizeLine}.` : "",
    report.engineAdjusts ? "The engine strengthened the design to make it read back." : "",
  ]
    .filter(Boolean)
    .join("\n");
  return buildTextResult(summary, {
    grade: report.grade ?? "poor",
    symbolModules: report.symbolModules ?? 0,
    version: report.version ?? 0,
    smallestModulePx: report.smallestModulePx ?? null,
    designScore: report.designScore,
    designWarnings: report.designWarnings,
    elapsedMs: report.elapsedMs,
    engineAdjusts: Boolean(report.engineAdjusts),
    conditions,
    resolutions,
    sizes,
  });
}

export async function handleQrGenerateAi(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrGenerateAiInputSchema.parse(raw);
  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    content: input.content,
  };
  if (input.fileFormat !== undefined) payload["fileFormat"] = input.fileFormat;
  if (input.outputWidth !== undefined) payload["outputWidth"] = input.outputWidth;
  if (input.outputHeight !== undefined) payload["outputHeight"] = input.outputHeight;
  if (input.logoUrl !== undefined) payload["logoUrl"] = input.logoUrl;
  if (input.stylePreset !== undefined) payload["stylePreset"] = input.stylePreset;

  const result = await client.post<QrResponse>("/api/v1/qr/ai/generate/server", payload);
  if (!result.ok) return buildErrorResult(result, "qr_generate_ai");
  const ai = result.data;
  return buildQrResult(ai, {
    summary: `AI-generated QR for prompt: ${input.prompt}\ncontent: ${input.content}`,
    requestedFormat: input.fileFormat,
    structured: {
      content: input.content,
      aiExplanation: typeof ai.aiExplanation === "string" && ai.aiExplanation ? ai.aiExplanation : undefined,
      safeModeApplied: typeof ai.safeModeApplied === "boolean" ? ai.safeModeApplied : undefined,
    },
  });
}

/**
 * Helpers for building MCP tool results, including image content blocks
 * and consistent error reporting.
 */

import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import type { ApiFailure } from "./client.js";

/** Loose shape matching MCP SDK's `content` blocks. */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface ToolResult {
  content: ContentBlock[];
  /** Successful results only: conforms to the tool's outputSchema (tools/output.ts). */
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  /** Required by the MCP SDK's CallToolResult shape. */
  [key: string]: unknown;
}

export interface QrResponse {
  ok?: boolean;
  qrBase64?: string;
  format?: string;
  /** The engine's MIME type for the rendered file. */
  contentType?: string;
  sizeBytes?: number;
  /** qr_generate_ai only. */
  aiExplanation?: string;
  safeModeApplied?: boolean;
  metadata?: Record<string, unknown>;
  // Some content-builder endpoints also return the encoded string:
  payload?: string;
  // Pass-through for any extra fields we don't model:
  [key: string]: unknown;
}

const FORMAT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

const INLINE_FORMATS = new Set(["png", "jpg", "jpeg", "webp", "svg"]);

function inferFormat(data: QrResponse, fallback: string | undefined): string {
  if (typeof data.format === "string" && data.format.length > 0) {
    return data.format.toLowerCase();
  }
  return (fallback ?? "png").toLowerCase();
}

function mimeFor(format: string): string {
  return FORMAT_TO_MIME[format] ?? "application/octet-stream";
}

/**
 * Build a tool result for a QR generation response.
 * - Inline rasters/SVG become an image content block.
 * - PDFs get saved to a temp file and the path is returned in text.
 * - `structuredContent` carries the render facts (format, MIME type, size,
 *   PDF path) plus `opts.structured`; the base64 file itself stays in the
 *   image block instead of being duplicated into JSON.
 */
export async function buildQrResult(
  data: QrResponse,
  opts: {
    summary: string;
    requestedFormat?: string | undefined;
    /** The tool's own structured fields (encoded content, payload, AI notes); undefined values are dropped. */
    structured?: Record<string, unknown>;
  },
): Promise<ToolResult> {
  const format = inferFormat(data, opts.requestedFormat);
  const blocks: ContentBlock[] = [];
  const structured: Record<string, unknown> = { format };
  const mimeType =
    typeof data.contentType === "string" && data.contentType.length > 0
      ? data.contentType
      : FORMAT_TO_MIME[format];
  if (mimeType) structured["mimeType"] = mimeType;
  if (typeof data.sizeBytes === "number" && Number.isInteger(data.sizeBytes) && data.sizeBytes >= 0) {
    structured["sizeBytes"] = data.sizeBytes;
  }

  const detailLines: string[] = [opts.summary];
  if (data.metadata) {
    detailLines.push(`metadata: ${JSON.stringify(data.metadata)}`);
  }

  if (typeof data.qrBase64 === "string" && data.qrBase64.length > 0) {
    if (INLINE_FORMATS.has(format)) {
      // SVG often arrives base64-encoded too; MCP image blocks accept any binary mime.
      blocks.push({
        type: "image",
        data: data.qrBase64,
        mimeType: mimeFor(format),
      });
      detailLines.push(`format: ${format} (rendered inline)`);
    } else if (format === "pdf") {
      const tmpName = `qr-branding-${randomBytes(6).toString("hex")}.pdf`;
      const tmpPath = join(tmpdir(), tmpName);
      await writeFile(tmpPath, Buffer.from(data.qrBase64, "base64"));
      detailLines.push(`format: pdf`);
      detailLines.push(`saved to: ${tmpPath}`);
      structured["filePath"] = tmpPath;
    } else {
      detailLines.push(`format: ${format} (base64 payload returned; client cannot inline)`);
      detailLines.push(`base64 length: ${data.qrBase64.length}`);
    }
  }

  if (typeof data.payload === "string" && data.payload.length > 0) {
    detailLines.push(`encoded payload: ${data.payload}`);
  }

  for (const [key, value] of Object.entries(opts.structured ?? {})) {
    if (value !== undefined) structured[key] = value;
  }

  blocks.unshift({ type: "text", text: detailLines.join("\n") });
  return { content: blocks, structuredContent: structured };
}

/** Convert an upstream failure into a user-facing tool error. */
export function buildErrorResult(failure: ApiFailure, context: string): ToolResult {
  const lines: string[] = [];
  lines.push(`${context} failed (HTTP ${failure.status}).`);

  if (failure.status === 402 || failure.code === "out_of_api_credits") {
    lines.push(
      "Your QR Branding plan is out of API credits. " +
        "Top up at https://qr-branding.com/dashboard or upgrade to Studio for API access.",
    );
  } else if (failure.status === 401 || failure.status === 403) {
    lines.push(
      "Authentication failed. Verify QR_BRANDING_API_KEY is a valid key from " +
        "https://qr-branding.com/dashboard/keys and that the key is active.",
    );
  } else if (failure.status === 429) {
    lines.push("Rate limit exceeded. Wait a moment and retry, or upgrade your plan for higher limits.");
  }

  lines.push(`Upstream message: ${failure.message}`);
  if (failure.code) {
    lines.push(`Upstream code: ${failure.code}`);
  }

  return {
    isError: true,
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

/** Generic text-only success block with its structured counterpart (template list). */
export function buildTextResult(text: string, structuredContent: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text }], structuredContent };
}

import { z } from "zod/v3";

import type { QrBrandingClient } from "../client.js";
import { buildErrorResult, buildTextResult, type ToolResult } from "../result.js";

/**
 * `qr_list_ai_providers` — the engine's `GET /api/qr/ai/providers`.
 * Bring-your-own-key metadata: the MCP's qr_generate_ai uses the managed
 * path, so this only matters when someone runs the engine with their own key.
 */
export const qrListAiProvidersInputShape = {
  // No inputs: the provider list is public metadata.
};

export const qrListAiProvidersOutputShape = {
  count: z.number().int().describe("How many providers the engine lists."),
  modelsNote: z.string().describe("Reminder that the model list is a recommendation, not an allowlist."),
  providers: z
    .array(
      z.object({
        id: z.string().describe('Provider id to send as `llmProvider` (e.g. "openai").'),
        name: z.string().optional().describe("Human name of the provider."),
        defaultModel: z.string().optional().describe("Model used when the request omits `llmModel`."),
        availableModels: z.array(z.string()).describe("Recommended model ids for this provider."),
        acceptsAnyModel: z.boolean().describe("True: any model id the provider offers is accepted."),
      }),
    )
    .describe("The providers, in the engine's order."),
};

export const qrListAiProvidersInputSchema = z.object(qrListAiProvidersInputShape);

interface ProvidersResponse {
  count?: number;
  modelsNote?: string;
  providers?: Array<{
    id?: string;
    name?: string;
    defaultModel?: string;
    availableModels?: string[];
    acceptsAnyModel?: boolean;
  }>;
}

export async function handleQrListAiProviders(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  qrListAiProvidersInputSchema.parse(raw);
  const result = await client.get<ProvidersResponse>("/api/v1/qr/ai/providers");
  if (!result.ok) return buildErrorResult(result, "qr_list_ai_providers");
  const data = (result.data ?? {}) as ProvidersResponse;
  const providers = (Array.isArray(data.providers) ? data.providers : []).map((p) => ({
    id: p.id ?? "?",
    name: p.name,
    defaultModel: p.defaultModel,
    availableModels: Array.isArray(p.availableModels) ? p.availableModels : [],
    acceptsAnyModel: Boolean(p.acceptsAnyModel),
  }));
  const summary = [
    `${providers.length} providers for bring-your-own-key AI: ${providers.map((p) => p.id).join(", ")}.`,
    data.modelsNote ?? "Any model id your provider offers works.",
    "Pass `llmProvider` and `llmApiKey` to POST /api/qr/ai/generate. Not needed by qr_generate_ai.",
  ].join("\n");
  return buildTextResult(summary, {
    count: providers.length,
    modelsNote: data.modelsNote ?? "",
    providers,
  });
}

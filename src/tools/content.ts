/**
 * Specialised content-builders: Wi-Fi, vCard, geo URI.
 *
 * The engine's content endpoints only encode the payload string
 * (`{ success, text }`); we then render that string through /qr/generate so
 * the assistant gets the QR image, plus the payload for reference.
 */

import { z } from "zod/v3";

import type { QrBrandingClient } from "../client.js";
import { buildErrorResult, buildQrResult, type ToolResult, type QrResponse } from "../result.js";

interface ContentResponse {
  success?: boolean;
  text?: string;
}

/** Encodes via a content endpoint, then renders the payload as a PNG QR. */
async function encodeAndRender(
  client: QrBrandingClient,
  path: string,
  body: Record<string, unknown>,
  tool: string,
  summary: string,
): Promise<ToolResult> {
  const encoded = await client.post<ContentResponse>(path, body);
  if (!encoded.ok) return buildErrorResult(encoded, tool);
  const text = encoded.data.text;
  if (!text) {
    return {
      isError: true,
      content: [{ type: "text", text: `${tool} failed: the engine returned no payload.` }],
    };
  }
  const rendered = await client.post<QrResponse>("/api/v1/qr/generate", { content: text, eccLevel: "M" });
  if (!rendered.ok) return buildErrorResult(rendered, tool);
  return buildQrResult(rendered.data, {
    summary: `${summary}\nEncoded payload:\n${text}`,
    structured: { payload: text },
  });
}

/* ------------------------------------------------------------------ */
/* Wi-Fi                                                               */
/* ------------------------------------------------------------------ */

const WIFI_AUTH = ["WPA", "WEP", "nopass"] as const;

export const qrBuildWifiInputShape = {
  ssid: z.string().min(1).describe("The Wi-Fi network name (SSID)."),
  password: z
    .string()
    .optional()
    .describe('Network password. Required unless authType is "nopass".'),
  authType: z
    .enum(WIFI_AUTH)
    .optional()
    .describe('Authentication type. Defaults to "WPA". Use "nopass" for open networks.'),
  hidden: z
    .boolean()
    .optional()
    .describe("Set true if the SSID is hidden (not broadcast). Defaults to false."),
};

const qrBuildWifiInputSchema = z.object(qrBuildWifiInputShape);

export async function handleQrBuildWifi(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrBuildWifiInputSchema.parse(raw);
  // The engine names the auth type `encryption`.
  const payload: Record<string, unknown> = {
    ssid: input.ssid,
    encryption: input.authType ?? "WPA",
    hidden: input.hidden ?? false,
  };
  if (input.password !== undefined) payload["password"] = input.password;

  return encodeAndRender(
    client,
    "/api/v1/qr/content/wifi",
    payload,
    "qr_build_wifi",
    `Wi-Fi QR for SSID "${input.ssid}" (auth=${payload["encryption"]}, hidden=${payload["hidden"]})`,
  );
}

/* ------------------------------------------------------------------ */
/* vCard                                                               */
/* ------------------------------------------------------------------ */

export const qrBuildVcardInputShape = {
  firstName: z.string().min(1).describe("Contact's first name."),
  lastName: z.string().optional().describe("Contact's last name."),
  organization: z.string().optional().describe("Company or organization name."),
  phone: z
    .string()
    .optional()
    .describe("Phone number, including country code (e.g. +1-555-867-5309)."),
  email: z.string().email().optional().describe("Email address."),
  url: z.string().url().optional().describe("Personal or company website URL."),
};

const qrBuildVcardInputSchema = z.object(qrBuildVcardInputShape);

export async function handleQrBuildVcard(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrBuildVcardInputSchema.parse(raw);
  const payload: Record<string, unknown> = { firstName: input.firstName };
  if (input.lastName !== undefined) payload["lastName"] = input.lastName;
  if (input.organization !== undefined) payload["org"] = input.organization;
  if (input.phone !== undefined) payload["phone"] = input.phone;
  if (input.email !== undefined) payload["email"] = input.email;
  if (input.url !== undefined) payload["url"] = input.url;

  const name = [input.firstName, input.lastName].filter(Boolean).join(" ");
  return encodeAndRender(
    client,
    "/api/v1/qr/content/vcard",
    payload,
    "qr_build_vcard",
    `vCard QR for ${name}${input.organization ? ` (${input.organization})` : ""}`,
  );
}

/* ------------------------------------------------------------------ */
/* Geo                                                                 */
/* ------------------------------------------------------------------ */

export const qrBuildGeoInputShape = {
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .describe("Latitude in decimal degrees (-90 to 90)."),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .describe("Longitude in decimal degrees (-180 to 180)."),
};

const qrBuildGeoInputSchema = z.object(qrBuildGeoInputShape);

export async function handleQrBuildGeo(
  client: QrBrandingClient,
  raw: unknown,
): Promise<ToolResult> {
  const input = qrBuildGeoInputSchema.parse(raw);
  return encodeAndRender(
    client,
    "/api/v1/qr/content/geo",
    { lat: input.latitude, lng: input.longitude },
    "qr_build_geo",
    `Geo QR for ${input.latitude}, ${input.longitude}`,
  );
}

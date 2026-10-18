/**
 * Thin HTTP client for the QR Branding public API gateway.
 *
 * - Uses native fetch (Node 20+).
 * - Always attaches X-API-Key + User-Agent.
 * - Wraps responses into a typed result instead of throwing on non-2xx,
 *   so tool handlers can surface upstream error bodies verbatim.
 */

import type { ServerConfig } from "./config.js";

export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export interface ApiFailure {
  ok: false;
  status: number;
  /** Best-effort message extracted from the upstream JSON or text body. */
  message: string;
  /** Raw body (string) for diagnostics. */
  rawBody: string;
  /** Parsed JSON body if available. */
  jsonBody: unknown;
  /** Upstream error code if present (e.g. "out_of_api_credits"). */
  code: string | undefined;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

export class QrBrandingClient {
  constructor(private readonly config: ServerConfig) {}

  async request<T>(opts: RequestOptions): Promise<ApiResult<T>> {
    const url = `${this.config.baseUrl}${opts.path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.config.apiKey,
      "User-Agent": this.config.userAgent,
      Accept: "application/json",
    };

    let bodyText: string | undefined;
    if (opts.body !== undefined && opts.method !== "GET") {
      headers["Content-Type"] = "application/json";
      bodyText = JSON.stringify(opts.body);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: opts.method,
        headers,
        body: bodyText,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        status: 0,
        message: `Network error contacting ${url}: ${message}`,
        rawBody: "",
        jsonBody: undefined,
        code: undefined,
      };
    }

    const rawBody = await response.text();
    let jsonBody: unknown = undefined;
    if (rawBody.length > 0) {
      try {
        jsonBody = JSON.parse(rawBody);
      } catch {
        jsonBody = undefined;
      }
    }

    if (!response.ok) {
      const { message, code } = extractError(jsonBody, rawBody, response.status);
      return {
        ok: false,
        status: response.status,
        message,
        rawBody,
        jsonBody,
        code,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: (jsonBody as T) ?? (rawBody as unknown as T),
    };
  }

  get<T>(path: string): Promise<ApiResult<T>> {
    return this.request<T>({ method: "GET", path });
  }

  post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return this.request<T>({ method: "POST", path, body });
  }
}

function extractError(
  jsonBody: unknown,
  rawBody: string,
  status: number,
): { message: string; code: string | undefined } {
  if (jsonBody && typeof jsonBody === "object") {
    const obj = jsonBody as Record<string, unknown>;
    const code =
      typeof obj["code"] === "string"
        ? (obj["code"] as string)
        : typeof obj["error"] === "string"
          ? (obj["error"] as string)
          : undefined;
    const message =
      typeof obj["message"] === "string"
        ? (obj["message"] as string)
        : typeof obj["error_description"] === "string"
          ? (obj["error_description"] as string)
          : typeof obj["error"] === "string"
            ? (obj["error"] as string)
            : rawBody || `HTTP ${status}`;
    return { message, code };
  }
  return { message: rawBody || `HTTP ${status}`, code: undefined };
}

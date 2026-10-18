/**
 * Smoke test: verify the QR Branding gateway is reachable with the configured API key.
 *
 * Run from `mcp-server/`:
 *   QR_BRANDING_API_KEY=qrb_xxx pnpm smoke
 *   QR_BRANDING_API_KEY=qrb_xxx npm run smoke
 *
 * Optional env:
 *   QR_BRANDING_API_BASE_URL  — override base URL (default https://qr-branding.com)
 *   SMOKE_GENERATE=1          — also POST /api/v1/qr/generate with a tiny payload
 */

const apiKey = process.env["QR_BRANDING_API_KEY"]?.trim();
if (!apiKey) {
  console.error("[smoke] QR_BRANDING_API_KEY is not set. Aborting.");
  process.exit(1);
}

const baseUrl = (process.env["QR_BRANDING_API_BASE_URL"] || "https://qr-branding.com").replace(
  /\/+$/,
  "",
);

const headers: Record<string, string> = {
  "X-API-Key": apiKey,
  "User-Agent": "qr-branding-mcp-server-smoke/0.1.0",
  Accept: "application/json",
};

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<void> {
  const url = `${baseUrl}${path}`;
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  process.stdout.write(`\n[smoke] ${method} ${url}\n`);
  const t0 = Date.now();
  const res = await fetch(url, init);
  const elapsed = Date.now() - t0;
  const text = await res.text();
  process.stdout.write(`[smoke]   -> HTTP ${res.status} in ${elapsed}ms\n`);

  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (path === "/api/v1/qr/templates" && parsed) {
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed as { templates?: unknown[]; items?: unknown[]; data?: unknown[] }).templates ??
        (parsed as { items?: unknown[] }).items ??
        (parsed as { data?: unknown[] }).data ??
        [];
    process.stdout.write(`[smoke]   templates count: ${Array.isArray(list) ? list.length : "?"}\n`);
  } else if (parsed && typeof parsed === "object" && "qrBase64" in (parsed as object)) {
    const b64 = (parsed as { qrBase64?: string }).qrBase64 ?? "";
    process.stdout.write(`[smoke]   qrBase64 length: ${b64.length}\n`);
  } else if (text.length < 500) {
    process.stdout.write(`[smoke]   body: ${text}\n`);
  } else {
    process.stdout.write(`[smoke]   body: <${text.length} bytes>\n`);
  }

  if (!res.ok) {
    process.exitCode = 1;
  }
}

(async () => {
  await call("GET", "/api/v1/qr/ping");
  await call("GET", "/api/v1/qr/templates");

  if (process.env["SMOKE_GENERATE"] === "1") {
    await call("POST", "/api/v1/qr/generate", {
      content: "https://qr-branding.com",
      fileFormat: "png",
      outputWidth: 256,
      outputHeight: 256,
    });
  }

  process.stdout.write("\n[smoke] done.\n");
})().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[smoke] fatal: ${message}\n`);
  process.exit(1);
});

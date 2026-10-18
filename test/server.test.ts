/**
 * The server over an in-memory transport with a stubbed gateway: tools/list
 * carries outputSchema + annotations, and every successful call returns
 * structuredContent the SDK accepts (it validates it against outputSchema and
 * fails the call otherwise). Run: npm test.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { QrBrandingClient } from "../src/client.js";
import { createServer } from "../src/server.js";

const PNG_B64 = "iVBORw0KGgo=";

type Route = (body: unknown) => { status?: number; json: unknown };
const routes = new Map<string, Route>();
const realFetch = globalThis.fetch;

function stubFetch() {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? "GET"} ${url.pathname}`;
    const route = routes.get(key);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const answer = route ? route(body) : { status: 404, json: { message: `no route ${key}` } };
    return new Response(JSON.stringify(answer.json), {
      status: answer.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

let client: Client;

before(async () => {
  stubFetch();
  const gateway = new QrBrandingClient({
    apiKey: "qrb_test",
    baseUrl: "https://gateway.test",
    userAgent: "test",
    version: "0.0.0-test",
  });
  const server = createServer(gateway, "0.0.0-test");
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

after(async () => {
  globalThis.fetch = realFetch;
  await client.close();
});

const call = (name: string, args: Record<string, unknown>) =>
  client.callTool({ name, arguments: args }) as Promise<{
    content: Array<Record<string, unknown>>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  }>;

describe("tools/list", () => {
  it("declares an object outputSchema and the annotations on every tool", async () => {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 7);
    for (const t of tools) {
      assert.equal(t.outputSchema?.type, "object", t.name);
      const ai = t.name === "qr_generate_ai";
      assert.deepEqual(
        t.annotations,
        { title: t.title, readOnlyHint: !ai, destructiveHint: false, idempotentHint: !ai, openWorldHint: false },
        t.name,
      );
    }
  });
});

describe("structuredContent", () => {
  it("qr_generate: render facts from the engine plus the encoded content, image kept", async () => {
    routes.set("POST /api/v1/qr/generate", () => ({
      json: { success: true, qrBase64: PNG_B64, format: "png", contentType: "image/png", sizeBytes: 8 },
    }));
    const r = await call("qr_generate", { content: "https://qr-branding.com" });
    assert.equal(r.isError, undefined);
    assert.deepEqual(r.structuredContent, {
      format: "png",
      mimeType: "image/png",
      sizeBytes: 8,
      content: "https://qr-branding.com",
    });
    assert.deepEqual(r.content[1], { type: "image", data: PNG_B64, mimeType: "image/png" });
  });

  it("qr_generate with pdf: the temp file path is in structuredContent", async () => {
    routes.set("POST /api/v1/qr/generate", () => ({ json: { qrBase64: "JVBERi0=", format: "pdf" } }));
    const r = await call("qr_generate", { content: "x", fileFormat: "pdf" });
    const path = r.structuredContent?.["filePath"];
    assert.equal(typeof path, "string");
    assert.equal(r.structuredContent?.["mimeType"], "application/pdf");
    assert.ok(existsSync(path as string));
    rmSync(path as string);
  });

  it("qr_generate_ai: aiExplanation and safeModeApplied when the engine sends them", async () => {
    routes.set("POST /api/v1/qr/ai/generate/server", () => ({
      json: { qrBase64: PNG_B64, format: "png", aiExplanation: "Gold on black.", safeModeApplied: true, llmModelUsed: "m" },
    }));
    const r = await call("qr_generate_ai", { prompt: "gold", content: "x" });
    assert.deepEqual(r.structuredContent, {
      format: "png",
      mimeType: "image/png",
      content: "x",
      aiExplanation: "Gold on black.",
      safeModeApplied: true,
    });
  });

  it("qr_list_templates: templates (engine fields only) and total, filtered by category", async () => {
    routes.set("GET /api/v1/qr/templates", () => ({
      json: {
        success: true,
        count: 2,
        templates: [
          { id: "luxury-gold", name: "Luxury Gold", category: "business", description: "Gold." },
          { id: "neon", name: "Neon", category: "social" },
        ],
      },
    }));
    const r = await call("qr_list_templates", { category: "Business" });
    assert.deepEqual(r.structuredContent, {
      templates: [{ id: "luxury-gold", name: "Luxury Gold", category: "business", description: "Gold." }],
      total: 1,
      category: "Business",
    });
  });

  it("qr_generate_from_template: content only when overridden", async () => {
    routes.set("POST /api/v1/qr/templates/neon", () => ({ json: { qrBase64: PNG_B64, format: "png" } }));
    const r = await call("qr_generate_from_template", { templateId: "neon" });
    assert.deepEqual(r.structuredContent, { format: "png", mimeType: "image/png" });
  });

  it("qr_build_*: the built payload", async () => {
    routes.set("POST /api/v1/qr/content/geo", () => ({ json: { success: true, text: "geo:40.4168,-3.7038" } }));
    routes.set("POST /api/v1/qr/generate", () => ({ json: { qrBase64: PNG_B64, format: "png" } }));
    const r = await call("qr_build_geo", { latitude: 40.4168, longitude: -3.7038 });
    assert.deepEqual(r.structuredContent, { format: "png", mimeType: "image/png", payload: "geo:40.4168,-3.7038" });
  });

  it("errors stay isError results without structuredContent", async () => {
    routes.set("POST /api/v1/qr/generate", () => ({ status: 402, json: { code: "out_of_api_credits", message: "used up" } }));
    const r = await call("qr_generate", { content: "x" });
    assert.equal(r.isError, true);
    assert.equal(r.structuredContent, undefined);
  });
});

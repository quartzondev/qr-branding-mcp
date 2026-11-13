# Install / wiring sheet for AI agents

This file is for an AI coding agent (Cline, Cursor, Claude Code, Copilot, Windsurf…) that has to get the **QR Branding** MCP server working in a client without a human debugging it. It is deliberately short and mechanical. Read it top to bottom.

- Package: `@qr-branding/mcp-server` (npm, current version is in `package.json`)
- Remote endpoint: `https://qr-branding.com/mcp` (Streamable HTTP, no install)
- Registry id: `io.github.quartzondev/qr-branding`
- Protocol: MCP, `protocolVersion` `2025-06-18` (the server also accepts `2025-11-25`, `2025-03-26`, `2024-11-05`)

## 1. Choose the transport

**Prefer the remote endpoint** unless the client can only spawn a process. It needs no install, no Node and no version pinning.

```
POST https://qr-branding.com/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
```

**Use stdio** when the client requires a `command` (Claude Desktop, Cline's "command" server type, most VS Code setups):

```json
{
  "command": "npx",
  "args": ["-y", "@qr-branding/mcp-server"],
  "env": { "QR_BRANDING_API_KEY": "qrb_xxx" }
}
```

`-y` matters: without it `npx` asks for confirmation and the client's spawn hangs with no output.

## 2. Decide about the API key

- **No key**: the server starts and `tools/list` works. Calls that hit the gateway return a message explaining how to get a key. On the remote endpoint, no key means *trial mode*: PNG only, up to 720 px, 20 tool calls per day per network, no `qr_generate_ai`.
- **With a key**: a Studio API key (`qrb_...`) unlocks SVG/PDF, up to 4K, posters and AI designs. A key without a Studio pack answers HTTP 402 `studio_required`.
- Keys are created by the human at <https://qr-branding.com/dashboard/keys>. **Do not invent one and do not ask the user to paste one into a chat message** — tell them to put it in the client's config or export it in the shell.

If the client supports OAuth, skip the key entirely: a request without credentials gets `401` with

```
WWW-Authenticate: Bearer resource_metadata="https://qr-branding.com/.well-known/oauth-protected-resource"
```

Follow that metadata (RFC 9728) → authorization server metadata (RFC 8414) → dynamic client registration → PKCE consent. No key is stored anywhere.

## 3. Configure the client

| Client | Where |
|---|---|
| Claude Desktop | `claude_desktop_config.json` (macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`), `mcpServers` object |
| Claude Code | `claude mcp add --transport http qr-branding https://qr-branding.com/mcp` |
| Cursor | `%USERPROFILE%\.cursor\mcp.json` (`~/.cursor/mcp.json`) |
| Cline (VS Code) | **MCP Servers → Installed → Configure MCP Servers**, same `command`/`args`/`env` shape |
| VS Code (Copilot) | `.vscode/mcp.json` |
| Anything else | stdio: `npx -y @qr-branding/mcp-server`; HTTP: `https://qr-branding.com/mcp` |

## 4. Verify

After wiring, ask the client for the tool list. A healthy server returns **11 tools**:

```
qr_generate, qr_generate_ai, qr_scan_check, qr_list_templates, qr_get_template,
qr_generate_from_template, qr_poster, qr_build_wifi, qr_build_vcard, qr_build_geo,
qr_list_ai_providers
```

Then call a cheap, always-safe tool: `qr_build_geo` with `latitude: 40.4168, longitude: -3.7038`. It returns an image block plus `structuredContent`. It needs neither credits nor a key on the remote endpoint.

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| Client hangs on start, no output | `npx` waiting for confirmation → add `-y` |
| `tools/list` empty, stderr says the server cannot find the key | normal in keyless mode; configure a key or use the remote endpoint |
| HTTP 402 `studio_required` / `out_of_api_credits` | the key has no Studio pack or no credits; the tool message says where to fix it |
| HTTP 401 with `WWW-Authenticate` | no credentials: add the header, or complete the OAuth flow |
| HTTP 403 `Cross-origin requests are not allowed` | the request sent an unexpected `Origin`; only first-party client origins are accepted |
| Tools missing from the list | an older package version; use `@qr-branding/mcp-server@latest` |

## 6. What this server is for

Everything a model needs to produce a QR that actually scans: branded design (module/finder shapes, gradients, logo, caption, 118 templates), print-ready posters, Wi‑Fi/vCard/geo payloads, and a print check that decodes the rendered code under 13 simulated conditions before it goes to a printer. A flat matrix drawn locally by `qrcode`-style libraries cannot be decoded by the same process, so it cannot verify itself; this server decodes server-side (ISO/IEC 18004) and returns the verdict.

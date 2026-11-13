# QR Branding MCP server

MCP server for the [QR Branding](https://qr-branding.com) API. Lets Claude Desktop, Claude Code, Cursor, Cline, VS Code, ChatGPT desktop, and any other Model Context Protocol client generate branded QR codes, render any of the 118 curated templates, print-ready posters, or assemble Wi‑Fi / vCard / geo payloads — and check a design the way a phone camera will read it.

Every render is decoded server-side (ISO/IEC 18004) before it is returned, so a design that would not scan is caught here instead of on the printed piece.

- npm: [`@qr-branding/mcp-server`](https://www.npmjs.com/package/@qr-branding/mcp-server) · version in `server.json` / `package.json`
- Official MCP registry: `io.github.quartzondev/qr-branding`
- Remote endpoint (no install): `https://qr-branding.com/mcp`
- Docs (9 languages): <https://qr-branding.com/docs/integrations/mcp>
- Agent-oriented install sheet: [llms-install.md](./llms-install.md)

## Install

```bash
npx -y @qr-branding/mcp-server
```

The server starts without an API key: `tools/list` works, and any tool that needs the gateway explains how to get a key instead of failing silently. Read [Limits and billing](#limits-and-billing) for what a key unlocks.

## Get an API key

Sign in at [qr-branding.com](https://qr-branding.com) and create a key under **Dashboard → API keys** (`/dashboard/keys`). Keys look like `qrb_xxx...`. API access requires an active **Studio** pack; without one every call returns HTTP 402 `studio_required`.

## Client config

### Claude Desktop (`claude_desktop_config.json`) / Claude Code (`.mcp.json`)

Claude Desktop: Settings → Developer → Edit Config opens the file (macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`).

```json
{
  "mcpServers": {
    "qr-branding": {
      "command": "npx",
      "args": ["-y", "@qr-branding/mcp-server"],
      "env": {
        "QR_BRANDING_API_KEY": "qrb_xxx"
      }
    }
  }
}
```

Omit the `env` block to start in keyless mode.

### Cursor / Cline / VS Code

Same `command` + `args` + `env` shape as above, in the client's own MCP settings file (`%USERPROFILE%\.cursor\mcp.json`, Cline's **MCP Servers → Configure**, `.vscode/mcp.json`).

### Optional environment

- `QR_BRANDING_API_KEY` — Studio key. Without it the tools that hit the gateway return a message explaining how to create one.
- `QR_BRANDING_API_BASE_URL` — override the gateway URL. Default `https://qr-branding.com`. Useful for self-hosters and staging.

## Remote server (no install)

The same eleven tools are served over Streamable HTTP at `https://qr-branding.com/mcp`.

```bash
claude mcp add --transport http qr-branding https://qr-branding.com/mcp --header "Authorization: Bearer qrb_xxx"
```

Without a key the remote server answers in a **keyless trial** mode: every tool except `qr_generate_ai`, PNG up to 720 px, 20 tool calls per day per network. A Studio key unlocks SVG/PDF, up to 4K, posters and AI designs.

Clients that prefer a browser consent flow over pasting a key can use the bundled **OAuth 2.1** server (dynamic client registration + PKCE): the 401 on `https://qr-branding.com/mcp` carries `WWW-Authenticate: Bearer resource_metadata="https://qr-branding.com/.well-known/oauth-protected-resource"`, so the client discovers the authorization server and walks the user through consent.

## Tools

| Tool | What it does |
|---|---|
| `qr_generate` | Manual QR generation with explicit colors, module/finder shapes, logo, caption, format. |
| `qr_generate_ai` | Prompt-driven design — the server-side LLM picks the style for you. |
| `qr_scan_check` | Renders a design and decodes it under 13 simulated conditions (small print, distance, blur, dim light, low contrast, glare, noise, rotation), returning a grade, the smallest module in px, minimum print sizes and design warnings. No image is returned. |
| `qr_list_templates` | List the 118 curated templates (id, name, description, preview thumbnail URL). |
| `qr_get_template` | Read one template's full design config, to start from it and tweak with `qr_generate`. |
| `qr_generate_from_template` | Render a template by id with per-call overrides (content, colors, format/size). |
| `qr_poster` | Print-ready poster (A4/A5/A6/Letter, minimal/band/card/tent layouts, headline, bleed and crop marks) as vector PDF or PNG. |
| `qr_build_wifi` | Encode Wi‑Fi credentials into a scannable Wi‑Fi QR. |
| `qr_build_vcard` | Encode a contact card (vCard) into a QR. |
| `qr_build_geo` | Encode latitude/longitude into a `geo:` URI QR. |
| `qr_list_ai_providers` | The LLM providers a bring-your-own-key AI design can target, with their default model. |

For raster/SVG outputs the tool returns an inline image block so the assistant shows the QR directly in chat. For PDF the tool saves to a temp file and returns the path.

## Usage examples

Ask your assistant things like:

- "Generate a QR code for https://qr-branding.com with a circular module shape and gold color."
- "Make me a luxury QR for my coffee brand — content is https://baristabros.example, gold dots on cream background."
- "Is this design going to scan if I print it at 30 mm? Run the print check."
- "List the QR templates in the 'business' category and render template 12 for https://acme.example."
- "Encode my home Wi-Fi as a QR: SSID 'HomeNetwork', password 'wifi-please-7', WPA, hidden."
- "Build a vCard QR for Jane Doe at Acme Inc., +1-555-867-5309, jane@acme.example, https://acme.example."
- "Make a geo QR for 40.4168, -3.7038 (Madrid)."
- "Give me an A4 poster with headline 'Scan for the menu' for https://acme.example/menu."

## Limits and billing

API access is metered by **API credits** issued with your plan or topped up via promo codes. The free tier has no API quota — the gateway returns HTTP 402 `out_of_api_credits` and the tool surfaces that verbatim with an upgrade hint. Manage your plan at [qr-branding.com/dashboard](https://qr-branding.com/dashboard).

## Privacy

This server only forwards your prompts/inputs to `qr-branding.com`. It does not phone home, does not include analytics or third-party telemetry, and reads `QR_BRANDING_API_KEY` only once at startup. The QR Branding privacy policy lives at [qr-branding.com/privacy](https://qr-branding.com/privacy).

## Develop locally

```bash
npm install
npm run build      # tsc → dist/
npm test           # tool surface + version parity

# smoke test the gateway with your key
QR_BRANDING_API_KEY=qrb_xxx npm run smoke
# include a sample QR generation
QR_BRANDING_API_KEY=qrb_xxx SMOKE_GENERATE=1 npm run smoke

# wire dist/index.js into your MCP client as a `command` for local testing
```

## License

MIT — see [LICENSE](./LICENSE).

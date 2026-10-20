# @qr-branding/mcp-server

[![QR Branding MCP server](https://mcprush.com/badge/qr-branding-mcp/card.svg)](https://mcprush.com/to/qr-branding-mcp?ref=badge)

MCP server for the [QR Branding](https://qr-branding.com) API. Lets Claude Desktop, Claude Code, Cursor, ChatGPT desktop, and any other Model Context Protocol client generate branded QR codes, render any of the 118 curated templates, or assemble Wi-Fi / vCard / geo payloads — all through your QR Branding API key.

## What it does

The server exposes the QR Branding public API gateway (`https://qr-branding.com/api/v1/...`) as a small set of MCP tools. The gateway handles authentication, credit metering and rate limiting; this server just forwards prompts/inputs from your assistant to the gateway and renders the QR image inline back into the chat.

## Install

```bash
npx -y @qr-branding/mcp-server
```

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

### Optional environment

- `QR_BRANDING_API_BASE_URL` — override the gateway URL. Default `https://qr-branding.com`. Useful for self-hosters and staging.

## Remote server (no install)

The same seven tools are served over Streamable HTTP at `https://qr-branding.com/mcp`. Claude Code:

```bash
claude mcp add --transport http qr-branding https://qr-branding.com/mcp --header "Authorization: Bearer qrb_xxx"
```

Want to try it before getting a key? The remote server also answers without one, in a keyless trial mode: every tool except `qr_generate_ai`, PNG up to 720 px, 20 tool calls per day per network. This npm package always needs `QR_BRANDING_API_KEY`.

Full docs: https://qr-branding.com/docs/integrations/mcp

## Tools

| Tool | What it does |
|---|---|
| `qr_generate` | Manual QR generation with explicit colors, module/finder shapes, logo, caption, format. |
| `qr_generate_ai` | Prompt-driven design — the server-side LLM (Groq → Gemini fallback) picks the style for you. |
| `qr_list_templates` | List the 118 curated templates (id, name, description, preview thumbnail URL). |
| `qr_generate_from_template` | Render a template by id with per-call overrides (content, colors, format/size). |
| `qr_build_wifi` | Encode Wi-Fi credentials into a scannable Wi-Fi QR. |
| `qr_build_vcard` | Encode a contact card (vCard) into a QR. |
| `qr_build_geo` | Encode latitude/longitude into a `geo:` URI QR. |

For raster/SVG outputs the tool returns an inline image block so the assistant shows the QR directly in chat. For PDF the tool saves to a temp file and returns the path.

## Usage examples

Ask your assistant things like:

- "Generate a QR code for https://qr-branding.com with a circular module shape and gold color."
- "Make me a luxury QR for my coffee brand — content is https://baristabros.example, gold dots on cream background."
- "List the QR templates in the 'business' category and render template 12 for https://acme.example."
- "Encode my home Wi-Fi as a QR: SSID 'HomeNetwork', password 'wifi-please-7', WPA, hidden."
- "Build a vCard QR for Jane Doe at Acme Inc., +1-555-867-5309, jane@acme.example, https://acme.example."
- "Make a geo QR for 40.4168, -3.7038 (Madrid)."

## Limits and billing

API access is metered by **API credits** issued with your plan or topped up via promo codes. The free tier has no API quota — the gateway returns HTTP 402 `out_of_api_credits` and the tool surfaces that verbatim with an upgrade hint. Manage your plan at [qr-branding.com/dashboard](https://qr-branding.com/dashboard).

## Privacy

This server only forwards your prompts/inputs to `qr-branding.com`. It does not phone home, does not include analytics or third-party telemetry, and reads `QR_BRANDING_API_KEY` only once at startup. The QR Branding privacy policy lives at [qr-branding.com/privacy](https://qr-branding.com/privacy).

## Develop locally

```bash
npm install
npm run build      # tsc → dist/

# smoke test the gateway with your key
QR_BRANDING_API_KEY=qrb_xxx npm run smoke
# include a sample QR generation
QR_BRANDING_API_KEY=qrb_xxx SMOKE_GENERATE=1 npm run smoke

# wire dist/index.js into your MCP client as a `command` for local testing
node dist/index.js
```

## License

MIT

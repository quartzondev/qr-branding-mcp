# Container image for the stdio MCP server. Directory crawlers (Glama) build it
# and ask for the tool list; it is also what "docker run" users get.
#
# It starts WITHOUT an API key on purpose: `tools/list` is public, so the image
# answers introspection out of the box. A tool that needs the API replies with
# "set QR_BRANDING_API_KEY" instead of crashing.
#
#   docker build -t qr-branding-mcp .
#   docker run --rm -i -e QR_BRANDING_API_KEY=qrb_xxx qr-branding-mcp

FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node", "dist/index.js"]

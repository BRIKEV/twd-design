# TWD Design: one Node process, no database, no build step (Node runs the TypeScript directly).

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-slim
# Chromium runs each new version's TWD scenarios before it is posted (SCENARIO_CHECK=off skips it).
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
# /healthz in both modes; Slack events too in HTTP mode. Socket Mode needs no inbound traffic.
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# SIGTERM lets running turns finish (SHUTDOWN_TIMEOUT_MS) before exiting.
STOPSIGNAL SIGTERM
CMD ["node", "src/index.ts"]

# UXRay hosted render worker. Cloudflare remains the public control plane;
# this container only runs the browser-capable Node/Playwright API.
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.61.1-noble
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    UXRAY_REQUIRE_PUBLIC_URL=true
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN mkdir -p reports/screenshots
EXPOSE 8080
CMD ["node", "dist/apps/api/src/index.js"]

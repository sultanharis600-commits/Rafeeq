# Build from the repository root:  docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace packages/shared --workspace apps/web --include-workspace-root
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w packages/shared && npm run build -w apps/web

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static apps/web/.next/static
EXPOSE 3001
USER node
CMD ["node", "apps/web/server.js"]

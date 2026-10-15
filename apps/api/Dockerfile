# Build from the repository root:  docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace packages/shared --workspace apps/api --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w packages/shared && npm run build -w apps/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/drizzle apps/api/drizzle
WORKDIR /repo/apps/api
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]

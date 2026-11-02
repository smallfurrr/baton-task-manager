FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# node-pg-migrate and pg are runtime dependencies, so the migration CLI ships in this image.
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
USER node
EXPOSE 3000
# Migrate, seed (idempotent), then replace the shell with the server.
CMD ["sh", "-c", "npm run migrate && node dist/db/seed.js && exec node dist/index.js"]

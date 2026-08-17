# Stage 1 — build the frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2 — serve the API and the built frontend from Node
#
# Nginx used to serve the static bundle, but the app now needs sessions, an
# admin section and per-user state, so a single Node process owns both.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY lib ./lib
COPY routes ./routes
COPY --from=builder /app/dist ./dist

# The SQLite database and secrets.json live here, mounted from the host so
# they survive every rebuild.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3080
ENV PORT=3080

# node:sqlite only prints an experimental warning on Node 22; no flag needed.
CMD ["node", "server.js"]

# SIMPLE — zero-dependency Node app (owner & creator: Daniel Pollard)
# Multi-stage build. Works on Render, Railway, Fly, or any Docker host.
FROM node:20-alpine

WORKDIR /app

# No npm deps to install — just copy the source.
COPY package.json ./
COPY server ./server
COPY public ./public
COPY data ./data

# The app is fully self-contained (Node built-ins only).
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Data dir is writable so the JSON store can persist across runs.
# Mount a volume here (or use the platform's persistent disk) to keep state.
VOLUME ["/app/data"]

CMD ["node", "server/server.js"]
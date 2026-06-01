FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/server/package*.json ./packages/server/

RUN npm ci

COPY tsconfig.base.json ./
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src ./packages/server/src

RUN npm run build -w @leaderlib/core && npm run build -w @leaderlib/server

WORKDIR /app/packages/server

EXPOSE 8080

ENV PORT=8080

CMD ["node", "dist/server.js"]

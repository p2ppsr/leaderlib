FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

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

USER 1000:1000

CMD ["node", "dist/server.js"]

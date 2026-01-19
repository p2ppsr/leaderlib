# Use Node 22 Alpine base
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY packages/server/package*.json ./

# Install dependencies from npm (including @leaderlib/core from registry)
RUN npm install

# Copy source code and tsconfig
COPY packages/server/src ./src
COPY packages/server/tsconfig.json ./

# Build the server
RUN npx tsc

# Expose the API port
EXPOSE 8080

# Set default port
ENV PORT=8080

# Start the server
CMD ["node", "dist/server.js"]

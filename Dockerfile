# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install pnpm globally
RUN npm install -g pnpm

# Install node modules
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build application
RUN pnpm run build

# Copy prisma folder to root BEFORE prune to ensure it's not deleted
RUN if [ -d "server/prisma" ]; then \
      cp -r server/prisma ./prisma && \
      echo "Copied prisma from server/prisma to root before prune"; \
    elif [ -d "prisma" ]; then \
      echo "Prisma folder already in root"; \
    else \
      mkdir -p ./prisma && \
      echo "Created empty prisma directory"; \
    fi

# Remove development dependencies
RUN pnpm prune --prod

# Final stage for app image
FROM base

# Install OpenSSL (required for secure database connections)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything from build stage (includes pruned node_modules, dist, and package.json)
COPY --from=build /app /app

# Explicitly copy server directory to final stage
COPY --from=build /app/server ./server

# Copy Prisma schema directory from build stage (already copied to root before prune)
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "npx prisma generate --schema=./prisma/schema.prisma && npx prisma db push --accept-data-loss --schema=./prisma/schema.prisma && node server/index.js"]

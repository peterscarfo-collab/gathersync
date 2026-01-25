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

# Ensure Prisma schema directory exists in root before prune
# Check common locations: root, server/prisma, or create empty directory
RUN if [ -d "prisma" ]; then \
      echo "Prisma folder found in root"; \
    elif [ -d "server/prisma" ]; then \
      cp -r server/prisma ./prisma && \
      echo "Copied prisma from server/ to root"; \
    else \
      mkdir -p ./prisma && \
      echo "Created empty prisma directory (Prisma may not be used)"; \
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

# Copy Prisma schema directory to final stage
COPY --from=build /app/prisma ./prisma

# Generate Prisma client to ensure it's ready for production (if schema exists)
RUN if [ -f "prisma/schema.prisma" ]; then \
      npx prisma generate; \
    else \
      echo "No schema.prisma found, skipping Prisma generate"; \
    fi

EXPOSE 3000
CMD ["node", "server/index.js"]

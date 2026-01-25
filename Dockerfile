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

# Remove development dependencies
RUN pnpm prune --prod

# Final stage for app image
FROM base

# Install OpenSSL (required for secure database connections)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything from build stage (includes pruned node_modules, dist, and package.json)
COPY --from=build /app /app

# Copy Prisma schema directory if it exists (conditional to avoid errors if not present)
# Note: This project uses Drizzle ORM, so Prisma may not be present
RUN if [ -d "/app/prisma" ]; then \
      cp -r /app/prisma ./prisma && \
      echo "Prisma schema found, generating client..." && \
      npx prisma generate || echo "Prisma generate failed (may not be installed)"; \
    else \
      echo "Prisma folder not found, skipping Prisma setup"; \
    fi

EXPOSE 3000
CMD ["node", "index.js"]

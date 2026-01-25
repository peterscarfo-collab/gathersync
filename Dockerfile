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

# Build backend server
RUN pnpm run build

# Set frontend environment variables for production build
# These EXPO_PUBLIC_* variables are baked into the frontend at build time
ENV EXPO_PUBLIC_API_BASE_URL=https://gathersync.fly.dev
ENV EXPO_PUBLIC_OAUTH_PORTAL_URL=https://gathersync.fly.dev/api/auth/google
ENV EXPO_PUBLIC_APP_ID=gathersync-prod

# Build frontend web app (environment variables above will be included)
RUN pnpm run build:web

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

# Copy frontend build (dist-web) to final stage
COPY --from=build /app/dist-web ./dist-web

EXPOSE 3000
CMD ["node", "server/index.js"]

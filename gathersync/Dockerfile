# Use Node.js 22 LTS
FROM node:22-slim

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY . .

# Build the server
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]

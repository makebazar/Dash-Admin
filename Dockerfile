# Build stage
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
RUN apk add --no-cache libc6-compat ffmpeg
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies needed for build)
# IMPORTANT: Force development mode to install devDependencies like typescript
# Set FFMPEG_BINARIES_SKIP_DOWNLOAD=1 and ELECTRON_SKIP_BINARY_DOWNLOAD=1 to avoid download issues
ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false \
    npm_config_progress=false \
    FFMPEG_BINARIES_SKIP_DOWNLOAD=1 \
    ELECTRON_SKIP_BINARY_DOWNLOAD=1

# Install dependencies with ignore-scripts to bypass the slow/hanging ffmpeg-static download
RUN --mount=type=cache,target=/root/.npm NODE_ENV=development npm ci --ignore-scripts --loglevel=info

# Install temporary build tools and rebuild bcrypt from source for Alpine (musl) compatibility
RUN apk add --no-cache make gcc g++ python3 && \
    npm rebuild bcrypt --build-from-source && \
    apk del make gcc g++ python3

# Copy application source code
COPY . .

# Set environment variable for build
ENV NEXT_TELEMETRY_DISABLED=1
# Skip static optimization completely
ENV NEXT_PRIVATE_SKIP_STATIC=1
# IMPORTANT: Force NODE_ENV=production during build
# Coolify injects NODE_ENV=development via ARG which breaks the build
ENV NODE_ENV=production
# Point to system ffmpeg
ENV FFMPEG_BIN=/usr/bin/ffmpeg

# Build Next.js application with explicit NODE_ENV and memory limits and cache mount
RUN --mount=type=cache,target=/app/.next/cache NODE_OPTIONS='--max-old-space-size=4096' NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production npm run build

# Production stage
FROM public.ecr.aws/docker/library/node:20-alpine AS runner
# Install ffmpeg and libc6-compat for sharp in production stage
RUN apk add --no-cache ffmpeg libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV FFMPEG_BIN=/usr/bin/ffmpeg

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

COPY --from=builder /app/scripts ./scripts

# Make startup script executable
RUN chmod +x ./scripts/start.sh

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use startup script that starts the app
CMD ["sh", "./scripts/start.sh"]

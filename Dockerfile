# Build stage for dependencies
FROM public.ecr.aws/docker/library/node:20-alpine AS deps
RUN apk add --no-cache libc6-compat ffmpeg
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies needed for build)
# IMPORTANT: Force development mode to install devDependencies like typescript
# Set FFMPEG_BINARIES_SKIP_DOWNLOAD=1 to avoid download issues during npm ci
ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false \
    npm_config_progress=false \
    npm_config_jobs=1 \
    FFMPEG_BINARIES_SKIP_DOWNLOAD=1

RUN NODE_ENV=development npm ci --no-audit --no-fund || (sleep 2 && NODE_ENV=development npm ci --no-audit --no-fund)

# Build stage
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
# Install ffmpeg for build stage if needed (though next build shouldn't need it)
RUN apk add --no-cache ffmpeg
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
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

# Build Next.js application with explicit NODE_ENV and memory limits
RUN NODE_OPTIONS='--max-old-space-size=4096' NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production npm run build

# Production stage
FROM public.ecr.aws/docker/library/node:20-alpine AS runner
# Install ffmpeg in production stage
RUN apk add --no-cache ffmpeg
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

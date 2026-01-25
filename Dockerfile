# Build stage for dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies needed for build)
# IMPORTANT: Force development mode to install devDependencies like typescript
RUN NODE_ENV=development npm ci

# Build stage
FROM node:20-alpine AS builder
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

# Build Next.js application with explicit NODE_ENV
RUN NODE_ENV=production npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy database files and migrations
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

# Copy pg module for migrations (not included in standalone by default)
COPY --from=builder /app/node_modules/pg ./node_modules/pg
COPY --from=builder /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=builder /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=builder /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=builder /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=builder /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=builder /app/node_modules/postgres-array ./node_modules/postgres-array
COPY --from=builder /app/node_modules/postgres-bytea ./node_modules/postgres-bytea
COPY --from=builder /app/node_modules/postgres-date ./node_modules/postgres-date
COPY --from=builder /app/node_modules/postgres-interval ./node_modules/postgres-interval
COPY --from=builder /app/node_modules/obuf ./node_modules/obuf
COPY --from=builder /app/node_modules/split2 ./node_modules/split2

# Make startup script executable
RUN chmod +x ./scripts/start.sh

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use startup script that runs migrations before starting
CMD ["sh", "./scripts/start.sh"]

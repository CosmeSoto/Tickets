##############################################################################
# PRODUCCIÓN — multi-stage build optimizado
#
# Stage 1 (deps)    — instala dependencias de Node
# Stage 2 (builder) — genera Prisma client + compila Next.js
# Stage 3 (runner)  — imagen mínima de runtime (~200 MB)
##############################################################################

# ── Stage 1: dependencias ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat openssl openssl-dev
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --omit=dev=false

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl openssl-dev
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar cliente Prisma para Linux
RUN npx prisma generate

# Next.js necesita NEXTAUTH_URL en build solo para generar rutas absolutas.
# Las demás variables se inyectan en runtime — NO en build time.
ARG NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Archivos estáticos públicos
COPY --from=builder /app/public ./public

# Output standalone de Next.js (incluye server.js y dependencias mínimas)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# Prisma — schema, migraciones y cliente generado
COPY --from=builder --chown=nextjs:nodejs /app/prisma              ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma  ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Herramientas para seed (tsx + bcryptjs)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx        ./node_modules/tsx
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs   ./node_modules/bcryptjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/tsx   ./node_modules/.bin/tsx
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/esbuild    ./node_modules/esbuild
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@esbuild   ./node_modules/@esbuild

# Entrypoint (migraciones + arranque)
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Directorio de uploads (sobreescrito por volumen en runtime)
RUN mkdir -p public/uploads && chown nextjs:nodejs public/uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["./entrypoint.sh"]

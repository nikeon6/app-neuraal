# ---------- deps ----------
    FROM node:20-alpine AS deps
    WORKDIR /app
    RUN corepack enable
    
    COPY package.json pnpm-lock.yaml ./
    RUN pnpm install --frozen-lockfile
    
    # ---------- build ----------
    FROM node:20-alpine AS build
    WORKDIR /app
    RUN corepack enable
    
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    
    # Prisma client (si tu build lo necesita)
    RUN pnpm prisma generate
    
    # Build Next
    RUN pnpm build
    
    # ---------- runtime ----------
    FROM node:20-alpine AS runtime
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOSTNAME=0.0.0.0
    RUN corepack enable
    
    # solo lo necesario para correr
    COPY --from=build /app/package.json ./package.json
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/.next ./.next
    COPY --from=build /app/public ./public
    COPY --from=build /app/next.config.mjs ./next.config.mjs
    COPY --from=build /app/next.config.js ./next.config.js
    COPY --from=build /app/prisma ./prisma
    
    EXPOSE 3000
    CMD ["pnpm", "start"]
    
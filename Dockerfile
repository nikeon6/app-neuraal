# ---------- deps ----------
    FROM node:20-alpine AS deps
    ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    WORKDIR /app
    RUN corepack enable
    
    COPY package.json pnpm-lock.yaml ./
    RUN pnpm install --frozen-lockfile --ignore-scripts=false
    
    # ---------- build ----------
    FROM node:20-alpine AS build
    ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    WORKDIR /app
    RUN corepack enable
    
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/neuraal?schema=public
    ENV DATABASE_URL=${DATABASE_URL}
    
    # Prisma client (si tu build lo necesita)
    RUN pnpm prisma generate
    
    # Build Next
    RUN pnpm build
    
    # ---------- runtime ----------
    FROM node:20-alpine AS runtime
    ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOSTNAME=0.0.0.0
    ENV HUSKY=0
    RUN corepack enable
    
 

    # Copiamos solo lo necesario que sí existe siempre
    COPY --from=build /app/package.json ./package.json
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/.next ./.next
    COPY --from=build /app/prisma ./prisma
    COPY --from=build /app/src ./src
    COPY --from=build /app/tsconfig.json ./tsconfig.json
    COPY --from=build /app/prisma.config.ts ./prisma.config.ts

    # IMPORTANTE: Prisma Client generado (en tu proyecto se genera en src/generated/prisma)
    COPY --from=build /app/src/generated ./src/generated

    # Opcionales: public y next.config.*
    # (Docker falla si haces COPY y no existen, así que lo hacemos condicional)
    COPY --from=build /app /tmp/app
    RUN set -eux; \
        if [ -d /tmp/app/public ]; then cp -r /tmp/app/public /app/; fi; \
        if [ -f /tmp/app/next.config.js ]; then cp /tmp/app/next.config.js /app/; fi; \
        if [ -f /tmp/app/next.config.mjs ]; then cp /tmp/app/next.config.mjs /app/; fi; \
        if [ -f /tmp/app/next.config.ts ]; then cp /tmp/app/next.config.ts /app/; fi; \
        rm -rf /tmp/app
    
    EXPOSE 3000
    CMD ["pnpm", "start"]
    
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

    # Build workers
    RUN pnpm build:workers

    
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
    COPY --from=build /app/dist ./dist

    # IMPORTANTE: Prisma Client generado (en tu proyecto se genera en src/generated/prisma)
    COPY --from=build /app/src/generated ./src/generated

    # Project-level Next runtime config used by next start
    COPY --from=build /app/next.config.ts ./next.config.ts
    
    EXPOSE 3000
    CMD ["pnpm", "start"]
    
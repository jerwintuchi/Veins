FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace metadata for deterministic install layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY src/shared/package.json ./src/shared/
COPY src/server/package.json ./src/server/

# Install all deps (tsx is a devDep of @veins/server; needed at runtime since we
# skip the tsc compile step and run TypeScript directly via tsx).
RUN pnpm install --frozen-lockfile

# Copy source after install so the install layer stays cached on code changes.
COPY src/shared/src ./src/shared/src
COPY src/server/src ./src/server/src
COPY src/server/tsconfig.json ./src/server/

ENV NODE_ENV=production
EXPOSE 3001

# pnpm exec resolves tsx from @veins/server's node_modules.
CMD ["pnpm", "--filter", "@veins/server", "run", "start"]

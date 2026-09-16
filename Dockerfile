FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/vyral_build

RUN npm run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh","-c","npx drizzle-kit migrate && exec node_modules/.bin/tsx server.ts"]

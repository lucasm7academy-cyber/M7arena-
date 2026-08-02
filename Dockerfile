# Multi-stage Dockerfile para M7Arena (Node API + Vite Static Assets) - ADR-010

FROM node:22-alpine AS base

# Builder para a API Node (api/)
FROM base AS api-builder
WORKDIR /app/api
COPY api/package*.json ./
COPY db/schema ../db/schema/
RUN npm install
COPY api/ ./
RUN npm run build

# Builder para o Front-end Vite (web/)
FROM base AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Runner para o serviço app (Node API)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeapp

# O volume uploads_data é montado em /var/www/uploads. Se a pasta não existir
# na imagem, o Docker cria o mountpoint como root e o nodeapp (uid 1001) não
# consegue escrever → EACCES em todo upload. Criar aqui com o dono certo faz o
# volume novo herdar a permissão.
RUN mkdir -p /var/www/uploads && chown -R nodeapp:nogroup /var/www/uploads

COPY --from=api-builder /app/api/node_modules ./node_modules
COPY --from=api-builder /app/api/dist ./dist
COPY --from=api-builder /app/api/package.json ./package.json

USER nodeapp

EXPOSE 3000

CMD ["node", "dist/api/src/index.js"]

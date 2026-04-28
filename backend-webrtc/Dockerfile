FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
RUN addgroup --system fluxion && adduser --system --ingroup fluxion fluxion
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./
USER fluxion
EXPOSE 9000
CMD ["node", "server.js"]

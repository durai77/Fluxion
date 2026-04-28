FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
RUN addgroup --system fluxion && adduser --system --ingroup fluxion fluxion
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
USER fluxion
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/v1/health || exit 1
CMD ["node", "src/index.js"]

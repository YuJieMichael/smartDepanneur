FROM node:18-alpine AS builder

# Prisma 在 Alpine 上需要 OpenSSL 和 libc 兼容层
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

# --- 生产阶段 ---
FROM node:18-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node prisma/seed-test-data.mjs && node dist/src/main.js"]

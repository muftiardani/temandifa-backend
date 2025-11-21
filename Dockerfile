# Tahap 1: Builder
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# Tahap 2: Final
FROM node:18-alpine
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules

COPY package*.json ./
COPY index.js .
COPY src/ ./src/

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p temp_uploads && chown -R appuser:appgroup temp_uploads

    USER appuser

EXPOSE 3000
CMD ["node", "index.js"]
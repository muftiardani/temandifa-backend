# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Stage 2: Production
FROM node:18-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .
ENV NODE_ENV=production
CMD [ "node", "index.js" ]
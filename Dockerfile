# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY studio/package*.json ./studio/
RUN cd studio && npm ci
COPY studio/ ./studio/
RUN cd studio && npm run build

# Production stage
FROM node:20-alpine

RUN apk add --no-cache ffmpeg rubberband

WORKDIR /app

# Copy backend package files and install dependencies (skip postinstall)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy backend source
COPY server.js ./
COPY config/ ./config/
COPY modules/ ./modules/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/public/studio ./public/studio

# Create directories for persistent data
RUN mkdir -p projects data .tmp_chunks

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]

# Studio API - Backend
FROM node:20-alpine

# Install FFmpeg and Rubberband for audio/video processing
RUN apk add --no-cache ffmpeg rubberband

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY server.js ./
COPY src/ ./src/

# Create directories for data
RUN mkdir -p projects .tmp_chunks

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]

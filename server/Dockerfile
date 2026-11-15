FROM golang:1.26-bookworm AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -trimpath -o /out/studio-server .

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl ffmpeg libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /out/studio-server /usr/local/bin/studio-server
RUN mkdir -p /app/projects /app/.tmp_chunks /app/stems-cache

ENV ROOT_PATH=/app \
    PORT=8080 \
    STEMS_DEVICE=cpu \
    STEMS_CACHE_DIR=/app/stems-cache

EXPOSE 8080
CMD ["studio-server"]

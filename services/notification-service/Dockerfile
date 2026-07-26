# Build aşaması — Go binary'yi derle
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# GOFLAGS=-p=1 + CGO_ENABLED=0: düşük bellekli ortamlarda (örn. Colima varsayılan
# 2GB VM) derleyicinin OOM'a takılmasını önler — paralel derleme yerine tek
# paket sırayla derlenir.
ENV GOFLAGS="-p=1" CGO_ENABLED=0 GOGC=20
RUN go build -o notification-service .

# Çalıştırma aşaması — sadece binary, alpine image (çok küçük)
FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/notification-service .
CMD ["./notification-service"]

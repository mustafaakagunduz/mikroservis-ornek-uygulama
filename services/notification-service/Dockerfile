# Build aşaması — Go binary'yi derle
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o notification-service .

# Çalıştırma aşaması — sadece binary, alpine image (çok küçük)
FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/notification-service .
CMD ["./notification-service"]

FROM golang:1.25-alpine AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
ARG TARGET=api
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/app ./cmd/${TARGET}

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/app /app
EXPOSE 8080
ENTRYPOINT ["/app"]

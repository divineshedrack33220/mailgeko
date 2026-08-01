GOCMD ?= go
BIN_DIR ?= bin

.PHONY: all build api worker test vet fmt tidy run-api run-worker docker-build

all: build

build:
	$(GOCMD) build -o $(BIN_DIR)/api ./cmd/api
	$(GOCMD) build -o $(BIN_DIR)/worker ./cmd/worker

api:
	$(GOCMD) build -o $(BIN_DIR)/api ./cmd/api

worker:
	$(GOCMD) build -o $(BIN_DIR)/worker ./cmd/worker

test:
	$(GOCMD) test ./...

vet:
	$(GOCMD) vet ./...

fmt:
	gofmt -l -w .

tidy:
	$(GOCMD) mod tidy

run-api:
	$(GOCMD) run ./cmd/api

run-worker:
	$(GOCMD) run ./cmd/worker

docker-build:
	docker build -t mailgeko/backend:latest .

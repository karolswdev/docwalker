SHELL := /bin/bash

.PHONY: install build lint format typecheck test ci clean help

help:
	@grep -E '^[a-zA-Z_-]+:.*?##' Makefile | sort | while read -r target desc; do \
		printf '\033[36m%-15s\033[0m %s\n' "$$target" "${desc##*##}"; \
	done

install: ## Install project dependencies
	npm install

build: ## Build the CLI distribution bundle
	npm run build

lint: ## Run lint checks
	npm run lint

format: ## Format code with Prettier
	npm run format

typecheck: ## Run TypeScript type checking without emit
	npm run typecheck

test: ## Execute unit tests
	npm run test

ci: ## Run lint, typecheck, tests, and build (used for CI pipelines)
	npm run ci

clean: ## Remove build artifacts
	rm -rf dist

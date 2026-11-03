# `make up`: builds and starts the app and the database in Docker.
# `make reset`: same, from a fresh game (empty database, no quest photos).
# pnpm is only used on the host to apply the Prisma schema (the app image
# doesn't ship Prisma).
SHELL := /bin/bash

# make doesn't read ~/.zshrc, where nvm and pnpm are set up: borrow its PATH
# when pnpm isn't found.
ZSH_PATH := $(shell command -v pnpm >/dev/null || zsh -ic 'print -r -- $$PATH' 2>/dev/null | tail -n 1)
ifneq ($(ZSH_PATH),)
export PATH := $(ZSH_PATH)
endif
PNPM := pnpm

.PHONY: up down reset restart logs ps

up:
	@[ -f .env ] || { echo "✖ No .env here (start from .env.example)." >&2; exit 1; }
	@# Created by Docker otherwise, owned by root: the app couldn't save photos.
	mkdir -p .data
	docker compose up -d --wait db
	@# Without --force-reset or --accept-data-loss, it stops instead of applying
	@# a change that would delete data.
	@$(PNPM) install --frozen-lockfile
	@$(PNPM) exec prisma db push
	@# On an empty database, the app fills it from prefill.json on startup.
	docker compose up -d --build --wait app

down:
	docker compose down

# Keeps postgres:17, which other projects' containers may use: only removes
# this project's containers, volume and app image.
reset:
	@read -r -p "Wipe the database and the quest photos? [y/N] " answer; \
		[ "$$answer" = y ] || { echo "Cancelled."; exit 1; }
	docker compose down --volumes --rmi local --remove-orphans
	rm -rf .data
	$(MAKE) up

restart:
	docker compose restart app

logs:
	docker compose logs -f app

ps:
	docker compose ps

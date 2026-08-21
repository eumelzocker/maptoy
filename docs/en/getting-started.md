---
id: getting-started
title: Getting started
language: en
---

# Getting started

maptoy is currently in its foundation phase. The development environment is defined
by the repository's Nix flake and loaded through direnv.

## Development commands

Run `pnpm install` once inside the development shell. Use `pnpm start` to build and
start the application, and `pnpm check` to run formatting, linting, builds, type
checks, and tests.

The server defaults to port `4004`. A reverse proxy can publish it below a subpath by
removing that prefix before forwarding requests. Application routes, assets, the
generated HTML base, and API calls remain relative to the public entry URL.

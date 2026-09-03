# maptoy-ff-ext

A private, locally-used and server-agnostic Firefox extension. It reads successful
responses matching configured rules (for example map tiles) exactly once, forwards
them unchanged via POST to a configurable HTTP endpoint, and passes the original
response through to the browser unchanged — no second source request. Its primary
use is forwarding tiles to maptoy, but neither the rules nor the runtime code depend
on a maptoy API contract. See [`plan.md`](plan.md) for the full background and design
decisions (in German).

## Setup

From the maptoy repository root, run `pnpm install`.

## Development

```sh
pnpm ff-ext:build      # compile src/ + copy public/ into dist/
pnpm ff-ext:test       # compile + run unit tests with node:test
pnpm ff-ext:typecheck  # strict TypeScript check without output
pnpm ff-ext:lint       # build + validate the extension with web-ext
pnpm ff-ext:check      # typecheck + tests + web-ext lint
pnpm ff-ext:start      # build + launch Firefox with the extension loaded
```

The generated, loadable extension is written to `extensions/firefox/dist/`.

## Project layout

- `src/` — TypeScript sources (compiled with plain `tsc`, no bundler)
- `public/` — static extension assets: `manifest.json`, `options.html`, `icon.svg`, `example-config.json`
- `dist/` — build output (`public/` copy + compiled `.js`); gitignored, this is what gets loaded into Firefox
- `dist-test/` — gitignored, used by `pnpm ff-ext:test`
- `config/` — real-world local configuration used during development (not part of the extension bundle)

## Configuring rules

Open the extension's options page (toolbar icon, or `about:addons`) to edit
the rule list as JSON, enable/disable the extension or POST logging, and
import/export the config. Each rule:

- `match`: a regex with named groups, e.g. `(?<mapname>[^/]+)`
- `target`: a target URL template referencing those groups as `${name}`
- `lookups` (optional, per named group): maps a captured value to another
  value; groups without a lookup table are passed through as-is
- `enabled` (optional, defaults to `true`)
- `maxResponseBytes` (optional per-rule override; `null` disables the limit)
- `responseStatusCodes` (optional exact allowlist; successful `2xx` responses are
  forwarded by default)
- `forwardResponseHeaders` (optional): maps source response header names to request
  header names sent to the target; header matching is case-insensitive and missing
  source headers are omitted

Response headers are never forwarded implicitly. This keeps the extension
server-agnostic and avoids disclosing response metadata to a target that did not ask
for it. Configure only headers whose meaning the target server understands and
trusts. `Content-Type` is handled separately and cannot be a mapped target header.
The bundled maptoy example maps upstream `ETag` and `Last-Modified` values to
maptoy's optional Tile-upload validator headers.

The top-level `maxResponseBytes` defaults to 10 MiB and can also be set to `null`.
Responses beyond the effective limit continue to the browser unchanged but are not
retained or posted. A target URL remains deduplicated after a successful POST. A
failed or rejected POST is released so a later matching browser response can try
again; the extension does not create its own retry request or queue. Successful
target URLs are kept in `browser.storage.session`, so deduplication survives
Manifest V3 background suspension but resets with the browser session or extension
reload.

If multiple rules match the same URL, or a lookup table is defined but has no
entry for the matched value, the request is logged as an error and no POST is
sent — the original response to the browser is never affected either way.

The options page ships a working maptoy-oriented example (MapTiler + OpenTopoMap
tiles), including optional upstream cache-validator forwarding, importable via its
"Import" button. Other HTTP servers can use different target header names or omit
header forwarding with the same generic rule format.

## Packaging boundary

The extension is independently versioned as `1.1.0`. Its package and Firefox
manifest versions must match. It is intentionally excluded from maptoy's Docker
build context and runtime image.

## Debugging

Background script logs (including POSTs, when "Log POSTs to console" is
enabled in the options page) show up in a dedicated console, not the page's
own DevTools:

`about:debugging#/runtime/this-firefox` → find `maptoy-ff-ext` → **Inspect**

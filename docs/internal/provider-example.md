# Example provider decision

Status: accepted for the initial implementation  
Last reviewed: 2026-08-21

## Decision

maptoy will initially ship only a deterministic local XYZ provider for development,
tests, screenshots, and demonstrations. It uses generated 256-pixel PNG tiles in
Web Mercator and the attribution `Synthetic maptoy test data`.

No public tile service is configured by default. Users must create a Map Set for a
real provider and review that provider's current terms themselves.

## OpenStreetMap Standard tiles

OpenStreetMap Standard was considered because it is a familiar XYZ source. It is
not suitable as maptoy's cache, batch-download, revision-history, or offline example.
The official policy for `tile.openstreetmap.org` explicitly prohibits bulk download,
pre-seeding, and offline download features. It also requires visible attribution, an
identifying User-Agent, and cache behavior based on the provider's HTTP headers.

Official references:

- <https://operations.osmfoundation.org/policies/tiles/>
- <https://www.openstreetmap.org/copyright>

The service could be configured manually for modest interactive viewing only, but
maptoy will not suggest a capability combination that conflicts with its policy.
The policy can change, so this note is technical guidance rather than permission or
legal advice.

## Requirements for a future bundled real example

A real example can replace or supplement the synthetic provider only after current
official documentation confirms all intended capabilities separately:

- interactive viewport requests;
- proxy caching and allowed retention;
- revision retention;
- prefetch or batch download;
- offline use;
- bitmap export and derived works;
- attribution wording and placement;
- rate, concurrency, header, authentication, and secret-handling rules.

Unknown capabilities default to disabled in an example Map Set.

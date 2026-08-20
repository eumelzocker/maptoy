# Rendering spike

This standalone prototype implements the deterministic scene defined in
[`../../docs/internal/phase-0-spike.md`](../../docs/internal/phase-0-spike.md).
It never contacts a tile provider.

From the repository root, enter the development environment and run:

```sh
direnv exec . pnpm --dir spikes/rendering install --frozen-lockfile
direnv exec . pnpm --dir spikes/rendering test
direnv exec . pnpm --dir spikes/rendering check
direnv exec . pnpm --dir spikes/rendering spike
```

Generated fixtures, images, and reports are written below `.artifacts/` and are
not committed. ExifTool comes from the Nix development shell and is used only to
create a synthetic GPS-tagged JPEG.

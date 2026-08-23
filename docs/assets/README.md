# Documentation assets

Shared local images and downloadable examples for the integrated documentation live
in this directory.

Reference a file from any `docs/<lang>/*.md` page with a relative path, e.g.
`<img src="../assets/eqearth.png" alt="..." width="300">`. This directory is
flat: only the filename is used to resolve the file, so filenames must be
unique across the whole directory. At build time the reference is rewritten to
`/docs-assets/<filename>`, which is served both in `pnpm dev` and in the
production build (including the Docker deployment).

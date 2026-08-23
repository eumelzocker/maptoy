import { createReadStream, existsSync, promises as fs } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const contentTypesByExtension: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".json": "application/json",
  ".geojson": "application/geo+json",
};

export async function copyDocsAssets(
  docsAssetsRoot: string,
  outDir: string,
): Promise<void> {
  if (!existsSync(docsAssetsRoot)) {
    throw new Error(
      `Documentation assets directory not found: ${docsAssetsRoot}`,
    );
  }
  await fs.cp(docsAssetsRoot, path.join(outDir, "docs-assets"), {
    recursive: true,
  });
}

export function createDocsAssetsMiddleware(
  docsAssetsRoot: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    const requestUrl = req.url ?? "";
    const pathname = requestUrl.split("?")[0] ?? "";
    let basename: string;
    try {
      basename = path.basename(decodeURIComponent(pathname));
    } catch {
      next();
      return;
    }
    if (basename.length === 0) {
      next();
      return;
    }
    const filePath = path.join(docsAssetsRoot, basename);
    fs.stat(filePath).then(
      (stat) => {
        if (!stat.isFile()) {
          next();
          return;
        }
        const contentType =
          contentTypesByExtension[path.extname(basename).toLowerCase()] ??
          "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", stat.size);
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        createReadStream(filePath).pipe(res);
      },
      () => {
        next();
      },
    );
  };
}

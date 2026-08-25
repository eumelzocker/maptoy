import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { TileFormat } from "@maptoy/contracts";

export class TileStorage {
  readonly tileDirectory: string;
  private readonly temporaryDirectory: string;

  constructor(private readonly dataDirectory: string) {
    this.tileDirectory = path.join(dataDirectory, "tiles");
    this.temporaryDirectory = path.join(dataDirectory, "tmp", "tiles");
  }

  relativeTilePath(
    mapSetId: string,
    tile: { zoom: number; x: number; y: number },
    contentHash: string,
    format: TileFormat,
  ): string {
    const extension = format === "jpeg" ? "jpg" : format;
    return path.posix.join(
      "tiles",
      mapSetId,
      String(tile.zoom),
      String(tile.x),
      `${tile.y}.${contentHash}.${extension}`,
    );
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.tileDirectory, { recursive: true }),
      mkdir(this.temporaryDirectory, { recursive: true }),
    ]);
    const entries = await readdir(this.temporaryDirectory, {
      withFileTypes: true,
    });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".partial"))
        .map((entry) => unlink(path.join(this.temporaryDirectory, entry.name))),
    );
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(this.absoluteManagedPath(relativePath));
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await access(this.absoluteManagedPath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async size(relativePath: string): Promise<number | null> {
    try {
      return (await stat(this.absoluteManagedPath(relativePath))).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async writeAtomic(relativePath: string, bytes: Buffer): Promise<void> {
    const destination = this.absoluteManagedPath(relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      if ((await readFile(destination)).equals(bytes)) {
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    const temporaryPath = path.join(
      this.temporaryDirectory,
      `${randomUUID()}.partial`,
    );
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    try {
      await rename(temporaryPath, destination);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async delete(relativePath: string): Promise<void> {
    const absolutePath = this.absoluteManagedPath(relativePath);
    await unlink(absolutePath).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    });
    await this.pruneEmptyTileDirectories(path.dirname(absolutePath));
  }

  async deleteMapSet(mapSetId: string): Promise<void> {
    await rm(this.mapSetDirectory(mapSetId), {
      recursive: true,
      force: true,
    });
  }

  async listMapSetFiles(
    mapSetId: string,
  ): Promise<Array<{ filePath: string; byteLength: number }>> {
    const root = this.mapSetDirectory(mapSetId);
    const files: Array<{ filePath: string; byteLength: number }> = [];
    const visit = async (directory: string): Promise<void> => {
      let entries: Dirent[];
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return;
        }
        throw error;
      }
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await visit(entryPath);
        } else if (entry.isFile()) {
          files.push({
            filePath: path
              .relative(this.dataDirectory, entryPath)
              .split(path.sep)
              .join(path.posix.sep),
            byteLength: (await stat(entryPath)).size,
          });
        }
      }
    };
    await visit(root);
    return files;
  }

  private mapSetDirectory(mapSetId: string): string {
    if (!/^[0-9a-f-]{36}$/.test(mapSetId)) {
      throw new Error("Refusing to access an invalid Map Set tile path.");
    }
    return path.join(this.tileDirectory, mapSetId);
  }

  private absoluteManagedPath(relativePath: string): string {
    const normalized = path.normalize(relativePath);
    const absolute = path.resolve(this.dataDirectory, normalized);
    const tilesRoot = `${path.resolve(this.tileDirectory)}${path.sep}`;
    if (!absolute.startsWith(tilesRoot)) {
      throw new Error("Tile path leaves the managed tile directory.");
    }
    return absolute;
  }

  private async pruneEmptyTileDirectories(start: string): Promise<void> {
    const tilesRoot = path.resolve(this.tileDirectory);
    let directory = path.resolve(start);
    while (directory.startsWith(`${tilesRoot}${path.sep}`)) {
      try {
        await rmdir(directory);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOTEMPTY" || code === "EEXIST") return;
        if (code !== "ENOENT") throw error;
      }
      directory = path.dirname(directory);
    }
  }
}

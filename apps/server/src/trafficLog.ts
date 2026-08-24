import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface TrafficLog {
  write(entry: Readonly<Record<string, unknown>>): void;
  close(): Promise<void>;
}

export interface RotatingTrafficLogOptions {
  directory: string;
  filename: string;
  maximumBytes: number;
  maximumFiles: number;
  onError?: (error: unknown) => void;
}

async function ignoreMissing(operation: Promise<unknown>): Promise<void> {
  try {
    await operation;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

export class RotatingTrafficLog implements TrafficLog {
  private readonly filePath: string;
  private pending: Promise<void>;
  private currentBytes = 0;

  private constructor(private readonly options: RotatingTrafficLogOptions) {
    this.filePath = path.join(options.directory, options.filename);
    this.pending = Promise.resolve();
  }

  static async create(
    options: RotatingTrafficLogOptions,
  ): Promise<RotatingTrafficLog> {
    const log = new RotatingTrafficLog(options);
    await mkdir(options.directory, { recursive: true });
    await writeFile(log.filePath, "", { flag: "a" });
    log.currentBytes = (await stat(log.filePath)).size;
    return log;
  }

  write(entry: Readonly<Record<string, unknown>>): void {
    const line = `${JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    })}\n`;
    const bytes = Buffer.byteLength(line);
    const operation = this.pending.then(async () => {
      if (
        this.currentBytes > 0 &&
        this.currentBytes + bytes > this.options.maximumBytes
      ) {
        await this.rotate();
      }
      await writeFile(this.filePath, line, { flag: "a" });
      this.currentBytes += bytes;
    });
    this.pending = operation.catch((error: unknown) => {
      this.options.onError?.(error);
    });
  }

  async close(): Promise<void> {
    await this.pending;
  }

  private async rotate(): Promise<void> {
    if (this.options.maximumFiles === 1) {
      await ignoreMissing(unlink(this.filePath));
      this.currentBytes = 0;
      return;
    }

    const lastArchive = `${this.filePath}.${this.options.maximumFiles - 1}`;
    await ignoreMissing(unlink(lastArchive));
    for (let index = this.options.maximumFiles - 2; index >= 1; index -= 1) {
      await ignoreMissing(
        rename(`${this.filePath}.${index}`, `${this.filePath}.${index + 1}`),
      );
    }
    await ignoreMissing(rename(this.filePath, `${this.filePath}.1`));
    this.currentBytes = 0;
  }
}

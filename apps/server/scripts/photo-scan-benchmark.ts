import {
  mkdir,
  opendir,
  readdir,
  stat,
  truncate,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { MaptoyConfig } from "@maptoy/config";
import type { Job } from "@maptoy/contracts";
import sharp from "sharp";
import { PhotoDirectory } from "../src/layers/photoDirectory.js";
import { buildServer } from "../src/server.js";

const mebibyte = 1024 * 1024;

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? fallback : process.argv[index + 1];
  if (value === undefined) {
    throw new Error(`Missing --${name}.`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return value;
}

async function assertEmptyDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const handle = await opendir(directory);
  try {
    if ((await handle.read()) !== null) {
      throw new Error(`Benchmark directory is not empty: ${directory}`);
    }
  } finally {
    await handle.close();
  }
}

async function createNoisyJpeg(
  target: string,
  width: number,
  height: number,
): Promise<void> {
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#808080",
      noise: { type: "gaussian", mean: 128, sigma: 30 },
    },
  })
    .jpeg({ quality: 85 })
    .toFile(target);
}

async function prepare(): Promise<void> {
  const directory = path.resolve(argument("photos"));
  await assertEmptyDirectory(directory);
  const groups = [
    { name: "small", count: 16, width: 2048, height: 1536 },
    { name: "medium", count: 6, width: 6000, height: 4000 },
    { name: "large", count: 2, width: 10_000, height: 8000 },
    { name: "over-pixels", count: 1, width: 12_000, height: 9000 },
  ];
  for (const group of groups) {
    for (let index = 0; index < group.count; index += 1) {
      await createNoisyJpeg(
        path.join(
          directory,
          `${group.name}-${String(index + 1).padStart(2, "0")}.jpg`,
        ),
        group.width,
        group.height,
      );
    }
  }
  await writeFile(path.join(directory, "broken.jpg"), "not an image");
  const oversizedPath = path.join(directory, "over-file-limit.jpg");
  await writeFile(oversizedPath, "");
  await truncate(oversizedPath, 100 * mebibyte + 1);
  process.stdout.write(
    `${JSON.stringify({ directory, files: 27, groups }, null, 2)}\n`,
  );
}

async function prepareListing(): Promise<void> {
  const directory = path.resolve(argument("photos"));
  const count = positiveInteger("count", 100_000);
  await assertEmptyDirectory(directory);
  let created = 0;
  while (created < count) {
    const group = Math.floor(created / 1000);
    const groupDirectory = path.join(
      directory,
      `directory-${String(group).padStart(3, "0")}`,
    );
    await mkdir(groupDirectory, { recursive: true });
    const batch = Array.from(
      { length: Math.min(250, count - created) },
      (_, offset) => created + offset,
    );
    await Promise.all(
      batch.map((index) =>
        writeFile(
          path.join(
            groupDirectory,
            `photo-${String(index).padStart(6, "0")}.jpg`,
          ),
          "",
        ),
      ),
    );
    created += batch.length;
  }
  process.stdout.write(
    `${JSON.stringify({ directory, files: created }, null, 2)}\n`,
  );
}

async function directoryBytes(directory: string): Promise<number> {
  const names = await readdir(directory);
  const files = await Promise.all(
    names.map((name) => stat(path.join(directory, name))),
  );
  return files.reduce((total, file) => total + file.size, 0);
}

async function waitForJob(
  server: Awaited<ReturnType<typeof buildServer>>,
  jobId: string,
): Promise<Job> {
  for (;;) {
    const response = await server.inject({
      method: "GET",
      url: `/api/jobs/${jobId}`,
    });
    const job = response.json<Job>();
    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function run(): Promise<void> {
  sharp.cache(false);
  const photosDirectory = path.resolve(argument("photos"));
  const dataDirectory = path.resolve(argument("data"));
  const concurrency = positiveInteger("concurrency", 2);
  const batchSize = positiveInteger("batch", 100);
  const previewMaximumEdge = positiveInteger("preview-edge", 640);
  const maximumDecodedPixels = positiveInteger("max-pixels", 100_000_000);
  await assertEmptyDirectory(dataDirectory);
  const config: MaptoyConfig = {
    server: { host: "127.0.0.1", port: 4004 },
    storage: {
      dataDirectory,
      databasePath: path.join(dataDirectory, "maptoy.sqlite"),
    },
    logging: {
      level: "silent",
      directory: path.join(dataDirectory, "logs"),
      trafficMaximumBytes: mebibyte,
      trafficMaximumFiles: 1,
    },
    tiles: {
      allowPrivateHosts: false,
      providerTimeoutMilliseconds: 1000,
      maximumBytes: 10 * mebibyte,
    },
    layers: { assetMaximumBytes: 25 * mebibyte },
    jobs: { retentionDays: 30, errorHistoryLimit: 100 },
    photos: {
      directory: photosDirectory,
      maximumFileBytes: 100 * mebibyte,
      maximumDecodedPixels,
      previewMaximumEdge,
      scanBatchSize: batchSize,
      scanConcurrency: concurrency,
      scanMaximumFiles: 100_000,
    },
  };
  const server = await buildServer({ config, serveWeb: false });
  const layerResponse = await server.inject({
    method: "POST",
    url: "/api/layers",
    payload: {
      name: "Benchmark photos",
      pluginId: "photo-layer",
      configuration: {},
      data: {},
      visible: true,
      displayOrder: 0,
      opacity: 1,
      minimumZoom: null,
      maximumZoom: null,
    },
  });
  const layerId = layerResponse.json<{ id: string }>().id;
  let peakRss = process.memoryUsage().rss;
  const baselineRss = peakRss;
  const sample = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 5);
  const startedAt = performance.now();
  const scanResponse = await server.inject({
    method: "POST",
    url: `/api/layers/${layerId}/photo-scan-jobs`,
    payload: { relativeDirectory: "", recursive: true },
  });
  const job = await waitForJob(server, scanResponse.json<{ id: string }>().id);
  const elapsedMilliseconds = performance.now() - startedAt;
  clearInterval(sample);
  const errorsResponse = await server.inject({
    method: "GET",
    url: `/api/jobs/${job.id}/errors`,
  });
  const errors = errorsResponse.json<{ items: unknown[] }>().items;
  const result = {
    photosDirectory,
    inputFiles: job.total,
    inputBytes: await directoryBytes(photosDirectory),
    concurrency,
    batchSize,
    previewMaximumEdge,
    maximumDecodedPixels,
    elapsedMilliseconds: Math.round(elapsedMilliseconds),
    filesPerSecond: Number(
      (job.total / (elapsedMilliseconds / 1000)).toFixed(2),
    ),
    baselineRssBytes: baselineRss,
    peakRssBytes: peakRss,
    peakRssDeltaBytes: peakRss - baselineRss,
    status: job.status,
    completed: job.completed,
    skipped: job.skipped,
    failed: job.failed,
    summary: job.summary,
    retainedErrors: errors.length,
  };
  await server.close();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function list(): Promise<void> {
  const photosDirectory = path.resolve(argument("photos"));
  const directory = new PhotoDirectory(photosDirectory);
  let peakRss = process.memoryUsage().rss;
  const baselineRss = peakRss;
  const sample = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 5);
  const startedAt = performance.now();
  const files = await directory.files("", true);
  const elapsedMilliseconds = performance.now() - startedAt;
  clearInterval(sample);
  process.stdout.write(
    `${JSON.stringify(
      {
        photosDirectory,
        files: files.length,
        elapsedMilliseconds: Math.round(elapsedMilliseconds),
        baselineRssBytes: baselineRss,
        peakRssBytes: peakRss,
        peakRssDeltaBytes: peakRss - baselineRss,
      },
      null,
      2,
    )}\n`,
  );
}

const command = process.argv[2];
if (command === "prepare") {
  await prepare();
} else if (command === "prepare-listing") {
  await prepareListing();
} else if (command === "run") {
  await run();
} else if (command === "list") {
  await list();
} else {
  throw new Error(
    "Use prepare, prepare-listing, run, or list with the required --photos and --data arguments.",
  );
}

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RotatingTrafficLog } from "./trafficLog.js";

describe("RotatingTrafficLog", () => {
  it("rotates JSON lines and retains only the configured file count", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-log-test-"));
    const log = await RotatingTrafficLog.create({
      directory,
      filename: "traffic.log",
      maximumBytes: 100,
      maximumFiles: 3,
    });

    for (let sequence = 1; sequence <= 4; sequence += 1) {
      log.write({ sequence, detail: "x".repeat(80) });
    }
    await log.close();

    const retainedSequences = await Promise.all(
      ["traffic.log", "traffic.log.1", "traffic.log.2"].map(
        async (filename) =>
          JSON.parse(await readFile(path.join(directory, filename), "utf8"))
            .sequence,
      ),
    );
    expect(retainedSequences).toEqual([4, 3, 2]);
    await expect(stat(path.join(directory, "traffic.log.3"))).rejects.toThrow();
    await rm(directory, { force: true, recursive: true });
  });
});

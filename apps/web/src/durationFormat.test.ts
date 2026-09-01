import { describe, expect, it } from "vitest";
import { formatDurationMinutes } from "./durationFormat.js";

describe("duration formatting", () => {
  it("formats cache ages as weeks, days, hours, and minutes", () => {
    expect(formatDurationMinutes(10_080 + 2_880 + 180 + 4)).toBe(
      "1 wk, 2 days, 3 hours, 4 mins",
    );
  });

  it("uses singular units and clamps negative durations", () => {
    expect(formatDurationMinutes(10_080 + 1_440 + 60 + 1)).toBe(
      "1 wk, 1 day, 1 hour, 1 min",
    );
    expect(formatDurationMinutes(-1)).toBe("0 mins");
  });
});

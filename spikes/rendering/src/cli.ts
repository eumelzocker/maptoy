import path from "node:path";
import exifr from "exifr";
import { OUTPUT_ROOT } from "./config.js";
import { generateFixtures } from "./fixtures.js";
import { runNativeMeasurement } from "./render-native.js";
import { runReprojectionMeasurements } from "./reproject.js";

const fixtures = await generateFixtures();
const gpsMetadata = (await exifr.parse(fixtures.gpsImage, {
  gps: true,
  pick: ["GPSLatitude", "GPSLongitude", "Orientation"],
})) as
  | { latitude?: number; longitude?: number; Orientation?: number | string }
  | undefined;

if (
  gpsMetadata?.latitude === undefined ||
  gpsMetadata.longitude === undefined ||
  (gpsMetadata.Orientation !== 6 && gpsMetadata.Orientation !== "Rotate 90 CW")
) {
  throw new Error(
    `Synthetic GPS metadata is invalid: ${JSON.stringify(gpsMetadata)}`,
  );
}

const report = await runNativeMeasurement(fixtures);
const reprojectionReport = await runReprojectionMeasurements(report.output);
console.log(
  JSON.stringify(
    {
      output: path.relative(process.cwd(), report.output),
      report: path.relative(
        process.cwd(),
        path.join(OUTPUT_ROOT, "native-measurement.json"),
      ),
      dimensions: `${report.width}x${report.height}`,
      averageMilliseconds: Number(report.averageMilliseconds.toFixed(2)),
      maxRssMegabytes: Number((report.maxRssKilobytes / 1024).toFixed(2)),
      sha256: report.sha256,
      reprojections: reprojectionReport.measurements.map((measurement) => ({
        target: measurement.targetProjection,
        dimensions: `${measurement.width}x${measurement.height}`,
        nodeMilliseconds: Number(measurement.nodeMilliseconds.toFixed(2)),
        gdalMilliseconds: Number(measurement.gdalMilliseconds.toFixed(2)),
        nodeMaxRssMegabytes: Number(
          (measurement.nodeMaxRssKilobytes / 1024).toFixed(2),
        ),
        gdalMaxRssMegabytes: Number(
          (measurement.gdalMaxRssKilobytes / 1024).toFixed(2),
        ),
        meanAbsoluteChannelDifference: Number(
          measurement.difference.meanAbsoluteChannelDifference.toFixed(3),
        ),
        pixelsAboveEight: measurement.difference.pixelsAboveEight,
      })),
    },
    null,
    2,
  ),
);

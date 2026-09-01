import type { PhotoMetadata } from "@maptoy/contracts";

export interface PhotoMetadataRow {
  label: string;
  value: string;
}

function shutterSpeedLabel(seconds: number): string {
  return seconds < 1
    ? `1/${Math.round(1 / seconds)} s`
    : `${seconds.toLocaleString("en-US", { maximumFractionDigits: 3 })} s`;
}

export function photoMetadataRows(
  metadata: PhotoMetadata | undefined,
): PhotoMetadataRow[] {
  if (metadata === undefined) return [];
  const rows: PhotoMetadataRow[] = [];
  if (metadata.capturedAt !== undefined) {
    rows.push({ label: "Captured at", value: metadata.capturedAt });
  }
  if (metadata.manufacturer !== undefined) {
    rows.push({ label: "Manufacturer", value: metadata.manufacturer });
  }
  if (metadata.cameraModel !== undefined) {
    rows.push({ label: "Camera model", value: metadata.cameraModel });
  }
  if (metadata.iso !== undefined) {
    rows.push({ label: "ISO", value: String(metadata.iso) });
  }
  if (metadata.fStop !== undefined) {
    rows.push({ label: "F-stop", value: `f/${metadata.fStop}` });
  }
  if (metadata.shutterSpeed !== undefined) {
    rows.push({
      label: "Shutter speed",
      value: shutterSpeedLabel(metadata.shutterSpeed),
    });
  }
  if (metadata.iptc?.caption !== undefined) {
    rows.push({ label: "IPTC caption", value: metadata.iptc.caption });
  }
  return rows;
}

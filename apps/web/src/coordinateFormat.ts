export const coordinateFormats = ["dd", "dms", "dmm"] as const;

export type CoordinateFormat = (typeof coordinateFormats)[number];

export function isCoordinateFormat(value: unknown): value is CoordinateFormat {
  return coordinateFormats.some((format) => format === value);
}

export function longitudeToDms(value: number): string {
  return toDms(value, "E", "W");
}

export function latitudeToDms(value: number): string {
  return toDms(value, "N", "S");
}

export function longitudeToDmm(value: number): string {
  return toDmm(value, "E", "W");
}

export function latitudeToDmm(value: number): string {
  return toDmm(value, "N", "S");
}

export function formatLongitude(
  value: number,
  format: CoordinateFormat,
): string {
  switch (format) {
    case "dms":
      return longitudeToDms(value);
    case "dmm":
      return longitudeToDmm(value);
    default:
      return toDecimalDegrees(value);
  }
}

export function formatLatitude(
  value: number,
  format: CoordinateFormat,
): string {
  switch (format) {
    case "dms":
      return latitudeToDms(value);
    case "dmm":
      return latitudeToDmm(value);
    default:
      return toDecimalDegrees(value);
  }
}

function toDecimalDegrees(value: number): string {
  return Number.isFinite(value) ? value.toFixed(5) : "—";
}

function toDms(
  value: number,
  positiveLetter: string,
  negativeLetter: string,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const totalSeconds = Math.round(Math.abs(value) * 36_000) / 10;
  const degrees = Math.floor(totalSeconds / 3_600);
  const remainingSeconds = totalSeconds - degrees * 3_600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds - minutes * 60;
  const letter = value >= 0 ? positiveLetter : negativeLetter;
  return `${degrees}°${minutes}'${seconds.toFixed(1)}"${letter}`;
}

function toDmm(
  value: number,
  positiveLetter: string,
  negativeLetter: string,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const totalMinutes = Math.round(Math.abs(value) * 60_000) / 1_000;
  const degrees = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - degrees * 60;
  const letter = value >= 0 ? positiveLetter : negativeLetter;
  return `${degrees}°${minutes.toFixed(3)}'${letter}`;
}

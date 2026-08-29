export type MapZoomDirection = "in" | "out";

export interface MapZoomModifiers {
  ctrlKey: boolean;
  shiftKey: boolean;
}

export function formatMapZoomLevel(value: number): string {
  const quarters = Math.round(value * 4);
  const sign = quarters < 0 ? "−" : "";
  const absoluteQuarters = Math.abs(quarters);
  const whole = Math.floor(absoluteQuarters / 4);
  const fraction = ["", "¼", "½", "¾"][absoluteQuarters % 4] ?? "";
  return `${sign}${whole}${fraction}`;
}

export function formatMapZoomTitle(value: number): string {
  return `z${Math.round(value * 4) / 4}`;
}

export function integerMapZoomTarget(
  value: number,
  direction: MapZoomDirection,
): number {
  return direction === "in" ? Math.floor(value) + 1 : Math.ceil(value) - 1;
}

export function quarterStepMapZoomTarget(
  value: number,
  direction: MapZoomDirection,
): number {
  const quarterSteps = Math.round(value * 4);
  return (quarterSteps + (direction === "in" ? 1 : -1)) / 4;
}

export function mapZoomControlTarget(
  value: number,
  direction: MapZoomDirection,
  modifiers: MapZoomModifiers,
  minimum: number,
  maximum: number,
): number {
  const target = modifiers.ctrlKey
    ? quarterStepMapZoomTarget(value, direction)
    : modifiers.shiftKey
      ? integerMapZoomTarget(value, direction)
      : value + (direction === "in" ? 1 : -1);
  return Math.min(maximum, Math.max(minimum, target));
}

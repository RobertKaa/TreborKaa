export const DEFAULT_SHAPE_VIEWBOX = '0 0 1000 1000';

export function buildShapeViewBox(path: string): string {
  const points = extractPathPoints(path);
  if (points.length === 0) {
    return DEFAULT_SHAPE_VIEWBOX;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return DEFAULT_SHAPE_VIEWBOX;
  }

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const padding = clamp(Math.max(width, height) * 0.06, 10, 34);

  const originX = roundViewboxNumber(minX - padding);
  const originY = roundViewboxNumber(minY - padding);
  const viewWidth = roundViewboxNumber(width + padding * 2);
  const viewHeight = roundViewboxNumber(height + padding * 2);

  return `${originX} ${originY} ${viewWidth} ${viewHeight}`;
}

function extractPathPoints(path: string): Array<[number, number]> {
  const values = path.match(/-?\d*\.?\d+/g);
  if (!values || values.length < 2) {
    return [];
  }

  const points: Array<[number, number]> = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    const x = Number(values[index]);
    const y = Number(values[index + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }

    points.push([x, y]);
  }

  return points;
}

function roundViewboxNumber(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

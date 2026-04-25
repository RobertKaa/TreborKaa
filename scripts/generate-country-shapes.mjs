import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/main/data/countries.geojson';
const REST_COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=cca2,cca3';
const WORLDCOUNTRIES_GEOMETRY_URL =
  'https://raw.githubusercontent.com/mledoze/countries/master/data/{cca3}.geo.json';
const VIEWBOX_SIZE = 1000;
const PADDING = 24;
const MIN_SIMPLIFY_TOLERANCE_DEGREES = 0.0025;
const MAX_SIMPLIFY_TOLERANCE_DEGREES = 0.04;
const REMOTE_COMPONENT_MAX_DISTANCE_DEGREES = 42;
const REMOTE_COMPONENT_MIN_RATIO_FOR_KEEP = 0.55;
const MIN_COMPONENT_AREA_RATIO = 0.0015;
const EXCLUDED_TERRITORY_CODES = new Set([
  'ax',
  'bq',
  'bv',
  'hm',
  'mf',
  'sj',
  'um'
]);
const FEATURE_NAME_CODE_OVERRIDES = new Map([
  ['France', 'fr'],
  ['Norway', 'no'],
  ['Kosovo', 'xk']
]);

const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);
const outputFile = resolve(thisDir, '../public/data/country-shapes.json');

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`);
}
const catalogResponse = await fetch(REST_COUNTRIES_URL);
if (!catalogResponse.ok) {
  throw new Error(
    `Failed to fetch ${REST_COUNTRIES_URL}: ${catalogResponse.status} ${catalogResponse.statusText}`
  );
}

const geoJson = await response.json();
if (!geoJson || !Array.isArray(geoJson.features)) {
  throw new Error('Invalid GeoJSON payload.');
}
const countriesCatalog = await catalogResponse.json();
if (!Array.isArray(countriesCatalog)) {
  throw new Error('Invalid countries catalog payload.');
}

const desiredCountries = countriesCatalog
  .map((item) => ({
    code: String(item?.cca2 ?? '')
      .trim()
      .toLowerCase(),
    cca3: String(item?.cca3 ?? '')
      .trim()
      .toLowerCase()
  }))
  .filter((item) => /^[a-z]{2}$/.test(item.code) && !EXCLUDED_TERRITORY_CODES.has(item.code));
const desiredCodes = new Set(desiredCountries.map((item) => item.code));
const shapesByCode = new Map();

for (const feature of geoJson.features) {
  const code = resolveFeatureCode(feature);
  if (!code || !desiredCodes.has(code) || shapesByCode.has(code)) {
    continue;
  }

  const path = geometryToPath(feature?.geometry);
  if (path) {
    shapesByCode.set(code, path);
  }
}

const missingCountries = desiredCountries.filter((country) => !shapesByCode.has(country.code));
for (const country of missingCountries) {
  if (!country.cca3 || !/^[a-z]{3}$/.test(country.cca3)) {
    continue;
  }

  const path = await fetchFallbackPath(country.cca3);
  if (!path) {
    continue;
  }

  shapesByCode.set(country.code, path);
}

const unresolvedCountries = desiredCountries
  .filter((country) => !shapesByCode.has(country.code))
  .map((country) => country.code);
const shapes = [...shapesByCode.entries()]
  .map(([code, path]) => ({ code, path }))
  .sort((left, right) => left.code.localeCompare(right.code));

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(shapes), 'utf8');

console.log(`Generated ${shapes.length} country shapes: ${outputFile}`);
console.log(`Coverage: ${shapes.length}/${desiredCountries.length}`);
if (unresolvedCountries.length > 0) {
  console.log(`Unresolved codes (${unresolvedCountries.length}): ${unresolvedCountries.join(', ')}`);
}

function geometryToPath(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    return null;
  }

  const rings = extractRings(geometry);
  if (rings.length === 0) {
    return null;
  }

  const projectedRings = rings
    .map((ring) => {
      const unwrapped = unwrapLongitude(ring);
      const tolerance = computeRingSimplifyTolerance(unwrapped);
      const simplified = simplifyRing(unwrapped, tolerance);
      if (simplified.length < 4) {
        return [];
      }

      return simplified.map(([longitude, latitude]) => [longitude, -latitude]);
    })
    .filter((ring) => ring.length >= 4);

  if (projectedRings.length === 0) {
    return null;
  }

  const alignedRings = alignRingsAroundDominant(projectedRings);
  const filteredRings = filterRingsForRecognition(alignedRings);
  const ringsForPath = filteredRings.length > 0 ? filteredRings : alignedRings;

  const bounds = computeBounds(ringsForPath);
  if (!bounds) {
    return null;
  }

  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const drawable = VIEWBOX_SIZE - PADDING * 2;
  const scale = Math.min(drawable / spanX, drawable / spanY);
  const offsetX = (VIEWBOX_SIZE - spanX * scale) / 2 - bounds.minX * scale;
  const offsetY = (VIEWBOX_SIZE - spanY * scale) / 2 - bounds.minY * scale;

  const parts = ringsForPath
    .map((ring) => {
      const compact = compactPoints(
        ring.map(([x, y]) => [roundNumber(x * scale + offsetX), roundNumber(y * scale + offsetY)])
      );
      if (compact.length < 3) {
        return '';
      }

      const [first, ...rest] = compact;
      return `M${first[0]} ${first[1]} ${rest.map((point) => `L${point[0]} ${point[1]}`).join(' ')} Z`;
    })
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  return parts.join(' ');
}

function computeRingSimplifyTolerance(points) {
  const bounds = computeBounds([points]);
  if (!bounds) {
    return MIN_SIMPLIFY_TOLERANCE_DEGREES;
  }

  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  return clamp(span * 0.0016, MIN_SIMPLIFY_TOLERANCE_DEGREES, MAX_SIMPLIFY_TOLERANCE_DEGREES);
}

function alignRingsAroundDominant(rings) {
  if (rings.length <= 1) {
    return rings;
  }

  const dominantRing = pickDominantRing(rings);
  if (!dominantRing) {
    return rings;
  }

  const [referenceX] = ringCentroid(dominantRing);

  return rings.map((ring) => {
    const [centroidX] = ringCentroid(ring);
    const shift = Math.round((referenceX - centroidX) / 360) * 360;
    if (shift === 0) {
      return ring;
    }

    return ring.map(([x, y]) => [x + shift, y]);
  });
}

function filterRingsForRecognition(rings) {
  const ringStats = rings
    .map((ring) => ({
      ring,
      area: Math.abs(ringArea(ring)),
      centroid: ringCentroid(ring)
    }))
    .filter((entry) => Number.isFinite(entry.area) && entry.area > 0);

  if (ringStats.length === 0) {
    return [];
  }

  const dominant = ringStats.reduce((best, entry) => (entry.area > best.area ? entry : best), ringStats[0]);
  const dominantArea = Math.max(dominant.area, 1e-6);
  const dominantCentroid = dominant.centroid;

  return ringStats
    .filter((entry) => {
      const areaRatio = entry.area / dominantArea;
      const distance = pointDistance(entry.centroid, dominantCentroid);
      if (distance <= REMOTE_COMPONENT_MAX_DISTANCE_DEGREES) {
        return areaRatio >= MIN_COMPONENT_AREA_RATIO;
      }

      return areaRatio >= REMOTE_COMPONENT_MIN_RATIO_FOR_KEEP;
    })
    .map((entry) => entry.ring);
}

function pickDominantRing(rings) {
  let dominantRing = null;
  let dominantArea = 0;

  for (const ring of rings) {
    const area = Math.abs(ringArea(ring));
    if (area > dominantArea) {
      dominantArea = area;
      dominantRing = ring;
    }
  }

  return dominantRing;
}

function ringArea(ring) {
  if (ring.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }

  return area / 2;
}

function ringCentroid(ring) {
  if (ring.length === 0) {
    return [0, 0];
  }

  const area = ringArea(ring);
  if (Math.abs(area) < 1e-9) {
    let sumX = 0;
    let sumY = 0;
    for (const [x, y] of ring) {
      sumX += x;
      sumY += y;
    }

    return [sumX / ring.length, sumY / ring.length];
  }

  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    const factor = x1 * y2 - x2 * y1;
    centroidX += (x1 + x2) * factor;
    centroidY += (y1 + y2) * factor;
  }

  return [centroidX / (6 * area), centroidY / (6 * area)];
}

function pointDistance(left, right) {
  const deltaX = left[0] - right[0];
  const deltaY = left[1] - right[1];
  return Math.hypot(deltaX, deltaY);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function fetchFallbackPath(cca3) {
  const url = WORLDCOUNTRIES_GEOMETRY_URL.replace('{cca3}', cca3);
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const geometry = extractFallbackGeometry(payload);
  if (!geometry) {
    return null;
  }

  return geometryToPath(geometry);
}

function extractFallbackGeometry(payload) {
  if (payload?.type === 'FeatureCollection' && Array.isArray(payload.features)) {
    const firstFeature = payload.features.find((feature) => feature?.geometry);
    return firstFeature?.geometry ?? null;
  }

  if (payload?.type === 'Feature' && payload.geometry) {
    return payload.geometry;
  }

  if (payload?.type === 'Polygon' || payload?.type === 'MultiPolygon') {
    return payload;
  }

  return null;
}

function resolveFeatureCode(feature) {
  const alpha2 = String(feature?.properties?.['ISO3166-1-Alpha-2'] ?? '')
    .trim()
    .toLowerCase();
  if (/^[a-z]{2}$/.test(alpha2)) {
    return alpha2;
  }

  if (alpha2 === 'cn-tw') {
    return 'tw';
  }

  const countryName = String(feature?.properties?.name ?? '').trim();
  return FEATURE_NAME_CODE_OVERRIDES.get(countryName) ?? null;
}

function extractRings(geometry) {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.filter((ring) => Array.isArray(ring) && ring.length >= 4);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .flatMap((polygon) => polygon)
      .filter((ring) => Array.isArray(ring) && ring.length >= 4);
  }

  return [];
}

function unwrapLongitude(ring) {
  if (!ring.length) {
    return [];
  }

  const first = ring[0];
  const normalized = [[first[0], first[1]]];
  let previous = first[0];

  for (let index = 1; index < ring.length; index += 1) {
    const [rawLongitude, latitude] = ring[index];
    let longitude = rawLongitude;

    while (longitude - previous > 180) {
      longitude -= 360;
    }

    while (longitude - previous < -180) {
      longitude += 360;
    }

    normalized.push([longitude, latitude]);
    previous = longitude;
  }

  return normalized;
}

function computeBounds(rings) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function compactPoints(points) {
  const compact = [];

  for (const point of points) {
    const last = compact[compact.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) {
      compact.push(point);
    }
  }

  if (compact.length > 1) {
    const first = compact[0];
    const last = compact[compact.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      compact.pop();
    }
  }

  return compact;
}

function roundNumber(value) {
  return Number((Math.round(value * 10) / 10).toFixed(1));
}

function simplifyRing(points, tolerance) {
  if (points.length <= 5) {
    return points;
  }

  const isClosed = samePoint(points[0], points[points.length - 1]);
  const base = isClosed ? points.slice(0, -1) : points.slice();
  if (base.length < 3) {
    return points;
  }

  const simplified = douglasPeucker(base, tolerance);
  if (simplified.length < 3) {
    return points;
  }

  if (isClosed) {
    simplified.push(simplified[0]);
  }

  return simplified;
}

function douglasPeucker(points, tolerance) {
  const sqTolerance = tolerance * tolerance;
  const last = points.length - 1;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[last] = 1;

  const stack = [[0, last]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxSqDistance = 0;
    let index = -1;

    for (let pointIndex = start + 1; pointIndex < end; pointIndex += 1) {
      const sqDistance = squareSegmentDistance(
        points[pointIndex],
        points[start],
        points[end]
      );

      if (sqDistance > maxSqDistance) {
        index = pointIndex;
        maxSqDistance = sqDistance;
      }
    }

    if (index !== -1 && maxSqDistance > sqTolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  const simplified = [];
  for (let index = 0; index <= last; index += 1) {
    if (keep[index]) {
      simplified.push(points[index]);
    }
  }

  return simplified;
}

function squareSegmentDistance(point, start, end) {
  const pointX = point[0];
  const pointY = point[1];
  const startX = start[0];
  const startY = start[1];
  const endX = end[0];
  const endY = end[1];
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  if (deltaX === 0 && deltaY === 0) {
    return squareDistance(pointX, pointY, startX, startY);
  }

  let ratio =
    ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / (deltaX * deltaX + deltaY * deltaY);
  ratio = Math.max(0, Math.min(1, ratio));

  return squareDistance(pointX, pointY, startX + ratio * deltaX, startY + ratio * deltaY);
}

function squareDistance(x1, y1, x2, y2) {
  const deltaX = x1 - x2;
  const deltaY = y1 - y2;
  return deltaX * deltaX + deltaY * deltaY;
}

function samePoint(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

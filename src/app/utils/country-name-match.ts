import { CountrySummary } from '../models/country-summary';

export function normalizeCountryName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);
  const currentRow = new Array<number>(right.length + 1);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    currentRow[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      currentRow[rightIndex + 1] = Math.min(
        currentRow[rightIndex] + 1,
        previousRow[rightIndex + 1] + 1,
        previousRow[rightIndex] + substitutionCost
      );
    }

    for (let index = 0; index < previousRow.length; index += 1) {
      previousRow[index] = currentRow[index];
    }
  }

  return currentRow[right.length];
}

export function maxAllowedEditDistance(normalizedNameLength: number): number {
  if (normalizedNameLength <= 3) {
    return 0;
  }

  if (normalizedNameLength <= 8) {
    return 1;
  }

  return 2;
}

type NameMatchCandidate = {
  countryCode: string;
  distance: number;
  referenceLength: number;
};

function normalizedCountryNames(country: CountrySummary): string[] {
  return Array.from(
    new Set([normalizeCountryName(country.nameFrench), normalizeCountryName(country.nameEnglish)].filter(Boolean))
  );
}

function bestNameMatch(normalizedAnswer: string, country: CountrySummary): NameMatchCandidate | null {
  let bestMatch: NameMatchCandidate | null = null;

  for (const name of normalizedCountryNames(country)) {
    const distance = levenshteinDistance(normalizedAnswer, name);
    const lengthDelta = Math.abs(normalizedAnswer.length - name.length);
    const threshold = maxAllowedEditDistance(name.length);

    if (distance > threshold || lengthDelta > threshold) {
      continue;
    }

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = {
        countryCode: country.code,
        distance,
        referenceLength: name.length
      };
    }
  }

  return bestMatch;
}

export function matchesCountryName(
  rawAnswer: string,
  targetCountry: CountrySummary,
  options?: { pool?: CountrySummary[] }
): boolean {
  const normalizedAnswer = normalizeCountryName(rawAnswer);
  if (!normalizedAnswer) {
    return false;
  }

  const targetMatch = bestNameMatch(normalizedAnswer, targetCountry);
  if (!targetMatch) {
    return false;
  }

  const pool = options?.pool;
  if (!pool || pool.length === 0) {
    return true;
  }

  let closestDistance = targetMatch.distance;
  let closestCodes = new Set<string>([targetCountry.code]);

  for (const country of pool) {
    const match = bestNameMatch(normalizedAnswer, country);
    if (!match) {
      continue;
    }

    if (match.distance < closestDistance) {
      closestDistance = match.distance;
      closestCodes = new Set([country.code]);
      continue;
    }

    if (match.distance === closestDistance) {
      closestCodes.add(country.code);
    }
  }

  return closestCodes.size === 1 && closestCodes.has(targetCountry.code);
}

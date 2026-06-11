import { CountryFlag } from '../models/country-flag';

export function resolveFlagUrl(country: CountryFlag): string {
  return resolveLocalFlagUrl(country.code);
}

export function resolveLocalFlagUrl(code: string): string {
  return `/data/flags/${code.toLowerCase()}.png`;
}

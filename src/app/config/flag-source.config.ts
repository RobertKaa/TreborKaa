import { CountryFlag } from '../models/country-flag';

type FlagSourceMode = 'remote-first' | 'local-first';

type FlagSourceConfig = {
  mode: FlagSourceMode;
  remoteBaseUrl: string;
  localBasePath: string;
};

const FLAG_SOURCE_CONFIG: FlagSourceConfig = {
  mode: 'remote-first',
  remoteBaseUrl: 'https://flagcdn.com/w320',
  localBasePath: 'assets/flags'
};

export function resolveFlagUrl(country: CountryFlag): string {
  const remoteUrl = resolveRemoteFlagUrl(country.code);
  const localUrl = `${FLAG_SOURCE_CONFIG.localBasePath}/${country.flagAssetName}`;

  return FLAG_SOURCE_CONFIG.mode === 'remote-first' ? remoteUrl : localUrl;
}

export function resolveRemoteFlagUrl(code: string): string {
  return `${FLAG_SOURCE_CONFIG.remoteBaseUrl}/${code.toLowerCase()}.png`;
}

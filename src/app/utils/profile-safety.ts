import { resolveLocalFlagUrl } from '../config/flag-source.config';

export type ProfileAvatarKey = string;

export const DEFAULT_PROFILE_AVATAR_KEY: ProfileAvatarKey = 'fr';

const LEGACY_AVATAR_KEYS: Record<string, ProfileAvatarKey> = {
  compass: 'fr',
  globe: 'br',
  bolt: 'jp',
  trophy: 'de',
  flag: 'fr',
  star: 'us',
};
const PROFILE_AVATAR_KEY_PATTERN = /^[a-z]{2}$/u;
const RESERVED_PROFILE_NAMES = [
  'admin',
  'administrateur',
  'moderateur',
  'moderatrice',
  'modérateur',
  'modératrice',
  'support',
  'systeme',
  'système',
  'vexiio',
];

const BLOCKED_PROFILE_TERMS = [
  'connard',
  'connasse',
  'encule',
  'enculé',
  'hitler',
  'nazi',
  'porno',
  'porn',
  'pute',
  'raciste',
  'salope',
  'sex',
];

export type ProfileNameValidationResult =
  | { value: string; errorKey: null }
  | { value: null; errorKey: string };

export function readProfileAvatarKey(value: unknown): ProfileAvatarKey {
  if (typeof value !== 'string') {
    return DEFAULT_PROFILE_AVATAR_KEY;
  }

  const normalized = value.toLowerCase().trim();
  if (PROFILE_AVATAR_KEY_PATTERN.test(normalized)) {
    return normalized;
  }

  return LEGACY_AVATAR_KEYS[normalized] ?? DEFAULT_PROFILE_AVATAR_KEY;
}

export function profileAvatarImageUrl(key: ProfileAvatarKey): string {
  return buildProfileFlagUrl(readProfileAvatarKey(key));
}

export function validateProfileDisplayName(value: string): ProfileNameValidationResult {
  const normalized = normalizeProfileName(value);

  if (normalized.length < 3) {
    return { value: null, errorKey: 'profile.error.nameTooShort' };
  }

  if (normalized.length > 18) {
    return { value: null, errorKey: 'profile.error.nameTooLong' };
  }

  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ._-]*$/u.test(normalized)) {
    return { value: null, errorKey: 'profile.error.invalidChars' };
  }

  if (looksLikeContactOrUrl(normalized)) {
    return { value: null, errorKey: 'profile.error.privateInfo' };
  }

  const moderationValue = normalizeForModeration(normalized);
  if (
    RESERVED_PROFILE_NAMES.some((term) => moderationValue === normalizeForModeration(term)) ||
    BLOCKED_PROFILE_TERMS.some((term) => moderationValue.includes(normalizeForModeration(term)))
  ) {
    return { value: null, errorKey: 'profile.error.blockedName' };
  }

  return { value: normalized, errorKey: null };
}

export function sanitizeProfileDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const result = validateProfileDisplayName(value);
  return result.errorKey ? null : result.value;
}

export function buildDefaultPublicDisplayName(userId: string): string {
  const suffix = userId.replace(/-/gu, '').slice(0, 6).toUpperCase();
  return suffix ? `Joueur ${suffix}` : 'Joueur Vexiio';
}

function normalizeProfileName(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeForModeration(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '');
}

function looksLikeContactOrUrl(value: string): boolean {
  return /@|https?:\/\/|www\.|(?:^|[^\p{L}\p{N}])[\p{L}\p{N}-]+\.(?:com|fr|net|org|io)\b/iu.test(
    value,
  );
}

function buildProfileFlagUrl(code: ProfileAvatarKey): string {
  return resolveLocalFlagUrl(code);
}

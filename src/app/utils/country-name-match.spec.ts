import { CountrySummary } from '../models/country-summary';
import {
  levenshteinDistance,
  matchesCountryName,
  maxAllowedEditDistance,
  normalizeCountryName
} from './country-name-match';

function country(
  code: string,
  nameFrench: string,
  nameEnglish: string = nameFrench
): CountrySummary {
  return {
    code,
    nameFrench,
    nameEnglish,
    capitalFrench: '',
    capitalEnglish: '',
    flagUrl: `https://example.com/${code}.png`
  };
}

describe('country-name-match', () => {
  describe('normalizeCountryName', () => {
    it('removes accents and normalizes punctuation', () => {
      expect(normalizeCountryName("Côte d'Ivoire")).toBe('cote d ivoire');
      expect(normalizeCountryName('  ÉTATS-UNIS  ')).toBe('etats unis');
    });
  });

  describe('maxAllowedEditDistance', () => {
    it('allows tighter matching for short names', () => {
      expect(maxAllowedEditDistance(3)).toBe(0);
      expect(maxAllowedEditDistance(8)).toBe(1);
      expect(maxAllowedEditDistance(12)).toBe(2);
    });
  });

  describe('levenshteinDistance', () => {
    it('counts insertions, deletions and substitutions', () => {
      expect(levenshteinDistance('france', 'frannce')).toBe(1);
      expect(levenshteinDistance('chili', 'chine')).toBe(2);
      expect(levenshteinDistance('france', 'allemagne')).toBeGreaterThan(2);
    });
  });

  describe('matchesCountryName', () => {
    const france = country('fr', 'France');
    const germany = country('de', 'Allemagne', 'Germany');
    const chile = country('cl', 'Chili', 'Chile');
    const china = country('cn', 'Chine', 'China');
    const ivoryCoast = country('ci', "Côte d'Ivoire", "Côte d'Ivoire");

    it('accepts exact French and English names', () => {
      expect(matchesCountryName('France', france)).toBe(true);
      expect(matchesCountryName('Germany', germany)).toBe(true);
      expect(matchesCountryName('Allemagne', germany)).toBe(true);
    });

    it('accepts answers without accents', () => {
      expect(matchesCountryName("Cote d'Ivoire", ivoryCoast)).toBe(true);
    });

    it('accepts minor typos on the target country', () => {
      expect(matchesCountryName('Frannce', france)).toBe(true);
      expect(matchesCountryName('Allemangne', germany)).toBe(true);
      expect(matchesCountryName('Chilie', chile)).toBe(true);
    });

    it('rejects completely wrong countries', () => {
      expect(matchesCountryName('Allemagne', france)).toBe(false);
      expect(matchesCountryName('Espagne', france)).toBe(false);
    });

    it('rejects answers closer to another country in the pool', () => {
      const pool = [chile, china];

      expect(matchesCountryName('Chine', chile, { pool })).toBe(false);
      expect(matchesCountryName('Chine', china, { pool })).toBe(true);
    });

    it('rejects ambiguous ties between close country names', () => {
      const pool = [chile, china];

      expect(matchesCountryName('Chili', chile, { pool })).toBe(true);
      expect(matchesCountryName('Chine', china, { pool })).toBe(true);
    });

    it('rejects answers that are too far from the target name', () => {
      expect(matchesCountryName('Turquie', france)).toBe(false);
      expect(matchesCountryName('Allem', germany)).toBe(false);
    });
  });
});

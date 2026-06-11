import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CountrySummary } from '../models/country-summary';
import { SPEEDRUN_SPLITS, SpeedrunQuestion } from '../models/speedrun';
import { SpeedrunAssetCacheService } from './speedrun-asset-cache.service';

describe('SpeedrunAssetCacheService', () => {
  const responses = new Map<string, Response>();
  const fetchMock = vi.fn();
  const revokeObjectUrlMock = vi.fn();
  let objectUrlIndex = 0;

  beforeEach(() => {
    localStorage.clear();
    responses.clear();
    fetchMock.mockReset();
    revokeObjectUrlMock.mockReset();
    objectUrlIndex = 0;

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({
        match: vi.fn(async (url: string) => responses.get(url)?.clone()),
        put: vi.fn(async (url: string, response: Response) => {
          responses.set(url, response.clone());
        }),
      }),
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => `blob:flag-${++objectUrlIndex}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrlMock,
    });

    fetchMock.mockImplementation(async (url: string) => {
      return createResponse(url);
    });
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads each required flag once and replaces remote URLs before the run', async () => {
    const service = TestBed.inject(SpeedrunAssetCacheService);
    const france = country('fr');
    const italy = country('it');
    const questions: SpeedrunQuestion[] = [
      {
        split: SPEEDRUN_SPLITS[0],
        questionNumber: 1,
        promptCountry: france,
        options: [france, italy],
        correctCode: france.code,
      },
      {
        split: SPEEDRUN_SPLITS[1],
        questionNumber: 1,
        promptCountry: italy,
        options: [france, italy],
        correctCode: italy.code,
      },
    ];

    const prepared = await service.prepareQuestions(questions);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(prepared[0].options.every((option) => option.flagUrl.startsWith('blob:'))).toBe(true);
    expect(prepared[1].promptCountry.flagUrl).toMatch(/^blob:/);

    await service.prepareQuestions(questions);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(2);
  });
});

function country(code: string): CountrySummary {
  return {
    code,
    nameEnglish: code,
    nameFrench: code,
    capitalEnglish: code,
    capitalFrench: code,
    flagUrl: `https://flagcdn.com/w320/${code}.png`,
  };
}

function createResponse(content: string): Response {
  return {
    ok: true,
    clone: () => createResponse(content),
    blob: async () => new Blob([content], { type: 'image/png' }),
  } as Response;
}

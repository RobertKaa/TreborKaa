import { TestBed } from '@angular/core/testing';
import { BrowserStorageService } from './browser-storage.service';

describe('BrowserStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('reads and writes json values safely', () => {
    const service = TestBed.inject(BrowserStorageService);

    service.setJson('test-key', { score: 12 });

    expect(service.getJson('test-key', { score: 0 })).toEqual({ score: 12 });
  });

  it('returns fallback when json is invalid', () => {
    const service = TestBed.inject(BrowserStorageService);
    localStorage.setItem('broken-key', '{not-json');

    expect(service.getJson('broken-key', { ok: true })).toEqual({ ok: true });
  });

  it('removes stored values', () => {
    const service = TestBed.inject(BrowserStorageService);
    service.setString('remove-key', 'value');

    service.remove('remove-key');

    expect(service.getString('remove-key')).toBeNull();
  });
});

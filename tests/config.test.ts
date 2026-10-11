import { describe, expect, it } from 'vitest';
import { isValidDateRestrict, loadConfig } from '../src/config';

const base = { SERPER_API_KEY: 'key' };

describe('loadConfig', () => {
  it('aplica valores por defecto', () => {
    expect(loadConfig(base)).toEqual({
      apiKey: 'key',
      maxPagesPerKeyword: 1,
      dateRestrict: undefined,
      concurrency: 4,
    });
  });

  it('lee los opcionales', () => {
    const config = loadConfig({ ...base, MAX_PAGES_PER_KEYWORD: '3', DATE_RESTRICT: 'w2', SEARCH_CONCURRENCY: '8' });
    expect(config).toMatchObject({ maxPagesPerKeyword: 3, dateRestrict: 'w2', concurrency: 8 });
  });

  it('falla si falta la API key', () => {
    expect(() => loadConfig({})).toThrow(/SERPER_API_KEY/);
    expect(() => loadConfig({ SERPER_API_KEY: '  ' })).toThrow(/SERPER_API_KEY/);
  });

  it('valida rangos y formatos', () => {
    expect(() => loadConfig({ ...base, MAX_PAGES_PER_KEYWORD: '11' })).toThrow(/MAX_PAGES_PER_KEYWORD/);
    expect(() => loadConfig({ ...base, SEARCH_CONCURRENCY: '0' })).toThrow(/SEARCH_CONCURRENCY/);
    expect(() => loadConfig({ ...base, DATE_RESTRICT: 'ayer' })).toThrow(/DATE_RESTRICT/);
  });
});

describe('isValidDateRestrict', () => {
  it.each([['d7', true], ['w2', true], ['m1', true], ['y1', true], ['m', false], ['1m', false], ['h3', false]])(
    '%s → %s',
    (value, expected) => expect(isValidDateRestrict(value)).toBe(expected),
  );
});

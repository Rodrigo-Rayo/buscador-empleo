import { AxiosError, AxiosHeaders, AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { FatalSearchError, RateLimitError, createHttpClient, searchPage } from '../src/serperSearch';

const NO_WAIT = { dateRestrict: 'w2', retryDelayMs: 0 };

const clientWith = (post: ReturnType<typeof vi.fn>) => ({ post }) as unknown as AxiosInstance;

const httpError = (status: number, message: string) =>
  new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders({ 'X-API-KEY': 'SECRET' }) },
    data: { message },
  });

describe('createHttpClient', () => {
  it('envía la API key en la cabecera X-API-KEY', () => {
    expect(createHttpClient('abc').defaults.headers['X-API-KEY']).toBe('abc');
  });
});

describe('searchPage', () => {
  it('mapea resultados orgánicos y envía paginación y filtro de fecha', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { organic: [{ title: 'T', link: 'L', snippet: 'S', position: 1 }, { title: 'sin link' }, null] },
    });
    const items = await searchPage(clientWith(post), 'q', 2, { dateRestrict: 'w2' });
    expect(items).toEqual([{ title: 'T', link: 'L', snippet: 'S' }]);
    expect(post.mock.calls[0]![1]).toMatchObject({ q: 'q', page: 3, num: 10, gl: 'es', tbs: 'qdr:w2' });
  });

  it('conserva la fecha que muestra Google cuando viene', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { organic: [{ title: 'T', link: 'L', date: 'hace 4 días' }, { title: 'U', link: 'M', date: '' }] },
    });
    expect(await searchPage(clientWith(post), 'q', 0, NO_WAIT)).toEqual([
      { title: 'T', link: 'L', snippet: '', date: 'hace 4 días' },
      { title: 'U', link: 'M', snippet: '' },
    ]);
  });

  it('no envía tbs si no hay DATE_RESTRICT', async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    expect(await searchPage(clientWith(post), 'q', 0, { dateRestrict: undefined })).toEqual([]);
    expect(post.mock.calls[0]![1].tbs).toBeUndefined();
  });

  it.each([
    [403, 'Unauthorized.'],
    [400, 'Not enough credits'],
  ])('lanza FatalSearchError con HTTP %i (%s)', async (status, message) => {
    const post = vi.fn().mockRejectedValue(httpError(status, message));
    await expect(searchPage(clientWith(post), 'q', 0, NO_WAIT)).rejects.toBeInstanceOf(FatalSearchError);
  });

  it('reintenta si Serper limita la frecuencia y devuelve el resultado', async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(httpError(429, 'Too many requests'))
      .mockRejectedValueOnce(httpError(429, 'Too many requests'))
      .mockResolvedValue({ data: { organic: [{ title: 'T', link: 'L' }] } });
    expect(await searchPage(clientWith(post), 'q', 0, NO_WAIT)).toHaveLength(1);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('se rinde tras 3 reintentos con un RateLimitError (que es fatal)', async () => {
    const post = vi.fn().mockRejectedValue(httpError(429, 'Too many requests'));
    const promise = searchPage(clientWith(post), 'q', 0, NO_WAIT);
    await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await expect(promise).rejects.toBeInstanceOf(FatalSearchError);
    expect(post).toHaveBeenCalledTimes(4);
  });

  it('no reintenta otros errores', async () => {
    const post = vi.fn().mockRejectedValue(httpError(403, 'Unauthorized.'));
    await expect(searchPage(clientWith(post), 'q', 0, NO_WAIT)).rejects.toThrow('Unauthorized.');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('lanza un error recuperable y descriptivo sin filtrar la API key', async () => {
    const post = vi.fn().mockRejectedValue(httpError(500, 'boom'));
    const promise = searchPage(clientWith(post), 'q', 0, NO_WAIT);
    await expect(promise).rejects.toThrow('Error de Serper (HTTP 500): boom');
    await expect(promise).rejects.not.toBeInstanceOf(FatalSearchError);
    await expect(promise).rejects.not.toThrow(/SECRET/);
  });

  it('propaga errores que no son de axios', async () => {
    const post = vi.fn().mockRejectedValue(new TypeError('raro'));
    await expect(searchPage(clientWith(post), 'q', 0, NO_WAIT)).rejects.toThrow('raro');
  });
});

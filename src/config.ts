const MAX_PAGES_LIMIT = 10;
const MAX_CONCURRENCY = 10;
const DATE_RESTRICT_PATTERN = /^[dwmy]\d+$/;

export interface AppConfig {
  readonly apiKey: string;
  readonly maxPagesPerKeyword: number;
  /** Ventana por defecto; cada perfil puede sobrescribirla */
  readonly dateRestrict: string | undefined;
  /** Búsquedas simultáneas contra Serper */
  readonly concurrency: number;
}

type Env = Record<string, string | undefined>;

function requireVar(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Copia .env.example a .env y rellénala.`);
  }
  return value;
}

function parseIntInRange(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max} (valor recibido: "${raw}").`);
  }
  return value;
}

export function isValidDateRestrict(value: string): boolean {
  return DATE_RESTRICT_PATTERN.test(value);
}

function parseDateRestrict(env: Env): string | undefined {
  const raw = env.DATE_RESTRICT?.trim();
  if (!raw) return undefined;
  if (!isValidDateRestrict(raw)) {
    throw new Error(`DATE_RESTRICT debe tener el formato d7, w2, m1, y1... (valor recibido: "${raw}").`);
  }
  return raw;
}

export function loadConfig(env: Env = process.env): AppConfig {
  return {
    apiKey: requireVar(env, 'SERPER_API_KEY'),
    maxPagesPerKeyword: parseIntInRange(env, 'MAX_PAGES_PER_KEYWORD', 1, 1, MAX_PAGES_LIMIT),
    dateRestrict: parseDateRestrict(env),
    concurrency: parseIntInRange(env, 'SEARCH_CONCURRENCY', 4, 1, MAX_CONCURRENCY),
  };
}

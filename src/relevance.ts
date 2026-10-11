import { normalizeText } from './text';

/**
 * Regla de encaje: si el título (en minúsculas y sin acentos) cumple `pattern`, suma `points` y muestra `label`
 * (con `label` vacío solo suma, sin etiqueta).
 */
export interface ScoringRule {
  readonly label: string;
  readonly pattern: string;
  readonly points: number;
}

export interface OfferTag {
  readonly label: string;
  readonly tone: 'good' | 'warn';
}

export interface OfferMatch {
  readonly encaje: number;
  readonly etiquetas: readonly OfferTag[];
}

/** Puntúa un título según las reglas del perfil. Positivo = encaja; negativo = probablemente no interesa. */
export function scoreTitle(titulo: string, rules: readonly ScoringRule[]): OfferMatch {
  const title = normalizeText(titulo);
  const matched = rules.filter((rule) => new RegExp(rule.pattern, 'i').test(title));
  return {
    encaje: matched.reduce((sum, rule) => sum + rule.points, 0),
    // Las reglas sin nombre solo ajustan el orden, sin etiqueta visible
    etiquetas: matched.filter((rule) => rule.label).map((rule) => ({ label: rule.label, tone: rule.points > 0 ? 'good' : 'warn' })),
  };
}

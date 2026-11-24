import { normalizeText } from './text';

/**
 * Regla de encaje: si el título (en minúsculas y sin acentos) cumple `pattern`, suma `points` y muestra `label`
 * (con `label` vacío solo suma, sin etiqueta).
 */
export interface ScoringRule {
  readonly label: string;
  readonly pattern: string;
  readonly points: number;
  /**
   * También mira la descripción, en las ofertas que la traen fiable (las de listados como Eduso). Solo para reglas
   * que no casen con el texto genérico que llevan todas las ofertas ("igualdad de oportunidades", "orientación sexual")
   */
  readonly alsoDescription?: boolean;
}

export interface OfferTag {
  readonly label: string;
  readonly tone: 'good' | 'warn';
}

export interface OfferMatch {
  readonly encaje: number;
  readonly etiquetas: readonly OfferTag[];
}

export interface ScorableOffer {
  readonly titulo: string;
  readonly descripcion?: string;
}

/** Puntúa una oferta según las reglas del perfil. Positivo = encaja; negativo = probablemente no interesa. */
export function scoreOffer({ titulo, descripcion }: ScorableOffer, rules: readonly ScoringRule[]): OfferMatch {
  const title = normalizeText(titulo);
  const withDescription = descripcion ? `${title} ${normalizeText(descripcion)}` : title;
  const matched = rules.filter((rule) => new RegExp(rule.pattern, 'i').test(rule.alsoDescription ? withDescription : title));
  return {
    encaje: matched.reduce((sum, rule) => sum + rule.points, 0),
    // Las reglas sin nombre solo ajustan el orden, sin etiqueta visible; una etiqueta no se repite aunque casen dos reglas
    etiquetas: matched
      .filter((rule, index) => rule.label && matched.findIndex((other) => other.label === rule.label) === index)
      .map((rule) => ({ label: rule.label, tone: rule.points > 0 ? 'good' : 'warn' })),
  };
}

/** Puntúa solo por el título (ofertas de Google, sin descripción fiable). */
export function scoreTitle(titulo: string, rules: readonly ScoringRule[]): OfferMatch {
  return scoreOffer({ titulo }, rules);
}

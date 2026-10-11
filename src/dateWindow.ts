const DAY_MS = 86_400_000;
// Margen para ofertas que Google indexa con retraso
const MARGIN_DAYS = 2;
const UNIT_DAYS: Record<string, number> = { d: 1, w: 7, m: 30, y: 365 };

/** "w2" → 14 días. Sin ventana → infinito. */
export function windowInDays(dateRestrict: string | undefined): number {
  if (!dateRestrict) return Number.POSITIVE_INFINITY;
  const unit = UNIT_DAYS[dateRestrict.charAt(0)];
  const amount = Number(dateRestrict.slice(1));
  return unit && Number.isInteger(amount) ? unit * amount : Number.POSITIVE_INFINITY;
}

/**
 * Ventana incremental: desde la oferta más reciente guardada (+ margen) hasta hoy, sin superar la máxima.
 * Con búsquedas diarias pide ~3 días en lugar de 2 semanas, y así las ofertas nuevas copan los 10 primeros resultados.
 */
export function effectiveDateRestrict(maxWindow: string | undefined, lastSaved: Date | null, now: Date): string | undefined {
  if (!lastSaved) return maxWindow;
  const days = Math.max(0, Math.ceil((now.getTime() - lastSaved.getTime()) / DAY_MS)) + MARGIN_DAYS;
  return days < windowInDays(maxWindow) ? `d${days}` : maxWindow;
}

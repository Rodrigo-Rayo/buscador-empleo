export const UNKNOWN_COMPANY = 'Desconocida';
export const UNKNOWN_LOCATION = 'No especificada';
export const REMOTE = 'Remoto';

export const TRUNCATION = /\.\.\.|…/;
const TRAILING_TRUNCATION = /\s*(?:\.\.\.|…)\s*$/;
const REMOTE_PATTERN = /\b(remoto|remote|teletrabajo|online)\b/i;

export function stripTruncation(text: string): string {
  return text.replace(TRAILING_TRUNCATION, '').trim();
}

export function mentionsRemote(text: string): boolean {
  return REMOTE_PATTERN.test(text);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "psicologo-forense-%C3%A1rea" → "Psicologo Forense Área" */
export function humanizeSlug(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Slug con un % suelto: se usa tal cual
  }
  return decoded.split('-').filter(Boolean).map(capitalize).join(' ');
}

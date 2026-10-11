import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/profiles';
import { scoreTitle } from '../src/relevance';

const rules = (id: string) => PROFILES.find((p) => p.id === id)!.page.scoring;
const dev = (titulo: string) => scoreTitle(titulo, rules('desarrollo'));

// Títulos reales guardados en ofertas.json
describe('scoreTitle (perfil desarrollo)', () => {
  it.each([
    ['Junior Developer (Angular & .NET )', 4, ['Angular', '.NET / C#', 'Junior']],
    ['Programador Full Stack Net Angular', 8, ['Angular', '.NET / C#', 'Full Stack']],
    ['Mid Angular Developer', 4, ['Angular', 'Mid']],
    ['desarrollador/a .net (teletrabajo)', 4, ['.NET / C#', 'Remoto / híbrido']],
    ['Programador/a Full Stack - Java/ Javascript/ PL-SQL/ Inglés', 3, ['Full Stack', 'SQL']],
    ['Frontend Developer (React/Angular)', 4, ['Angular', 'Node / React / Next']],
    ['Fullstack Developer', 2, ['Full Stack']],
    ['Senior .NET Developer', 3, ['.NET / C#', 'Senior']],
    ['Desarrollador Angular presencial', 2, ['Angular', 'Presencial']],
    ['Desarrollador/a Laravel Junior', -2, ['Junior']],
    ['Jr Qa Campaign Management Specialist Strategy Designer 100% Remoto', -4, ['Remoto / híbrido', 'Junior', 'No es desarrollo']],
  ])('%s → %i', (titulo, encaje, labels) => {
    const match = dev(titulo);
    expect(match.encaje).toBe(encaje);
    expect(match.etiquetas.map((t) => t.label)).toEqual(labels);
  });

  it('otros stacks no penalizan: está abierto a aprender', () => {
    expect(dev('Desarrollador Java Spring Boot').encaje).toBe(0);
    expect(dev('Python Developer').encaje).toBe(0);
  });

  it('no confunde JavaScript con Java ni "internet" con .NET', () => {
    expect(dev('Desarrollador JavaScript para Internet').encaje).toBe(0);
  });

  it('marca el tono según el signo de los puntos; "Senior" solo avisa, sin bajar el encaje', () => {
    expect(dev('Angular Junior').etiquetas).toEqual([
      { label: 'Angular', tone: 'good' },
      { label: 'Junior', tone: 'warn' },
    ]);
    expect(dev('Senior Developer')).toEqual({ encaje: 0, etiquetas: [{ label: 'Senior', tone: 'warn' }] });
  });
});

describe('scoreTitle (perfil internacional)', () => {
  const intl = (titulo: string) => scoreTitle(titulo, rules('internacional'));

  // Títulos reales de LinkedIn fuera de España (septiembre 2026)
  it.each([
    ['Full-Stack .NET Angular Developer at Wire IT', 8, ['Angular', '.NET / C#', 'Full Stack']],
    ['Senior Full-Stack Java/Angular Developer - Remote - European candidates', 8, ['Angular', 'Full Stack', 'Remoto / híbrido', 'Senior', 'Europa / España']],
    ['Full Stack Developer – Angular/.NET | Ecuador & Colombia', 5, ['Angular', '.NET / C#', 'Full Stack', 'Solo América / Asia']],
    ['Full Stack Engineer - EMEA', 4, ['Full Stack', 'Europa / España']],
    ['Senior .NET Developer (US only)', 0, ['.NET / C#', 'Senior', 'Solo América / Asia']],
    ['Software Engineer (Typescript) | $90/hr Remote', -1, ['TypeScript', 'Remoto / híbrido', 'Por horas (gig)']],
  ])('%s → %i', (titulo, encaje, labels) => {
    const match = intl(titulo);
    expect(match.encaje).toBe(encaje);
    expect(match.etiquetas.map((t) => t.label)).toEqual(labels);
  });

  it('comparte con desarrollo las reglas del stack (misma puntuación de Angular y .NET)', () => {
    expect(intl('Angular .NET Developer').encaje).toBe(dev('Angular .NET Developer').encaje);
  });
});

describe('scoreTitle (Gabi: trabajo social)', () => {
  const gabi = (titulo: string) => scoreTitle(titulo, rules('gabi')).encaje;

  it.each([
    ['Trabajadora Social', 3],
    ['Trabajador/a Social Residencia', 3],
    ['Trabajador social y gestión de proyectos', 4],
    ['Trabajador Social - Alcalá de Henares', 3],
    ['Limpiador/a para nave (Torrejón de Ardoz)', 0],
    ['Programador/a C++ inglés alto', 0],
    ['Coordinador/a de programa de atención humanitaria', 1],
    ['Educador/a Social (proyecto con jóvenes extutelados)', -2],
    ['Profesional social - Teleasistencia', 0],
    ['Trabajador/a social protección internacional', 5],
    ['Técnica de Igualdad', 3],
    ['Integrador/a Social Victimas Violencia de Género', 0],
    ['Técnico/a de Selección - Madrid', 2],
    ['Orientador/a laboral programa de empleo', 3],
    ['Psicólogo/a sanitario/a', -3],
  ])('%s → %i', (titulo, encaje) => expect(gabi(titulo)).toBe(encaje));
});

describe('scoreTitle (Amy: marketing)', () => {
  const amy = (titulo: string) => scoreTitle(titulo, rules('amy')).encaje;

  it.each([
    ['Marketing Coordinator - Sonae Sierra', 4],
    ['Coordinador de marketing y desarrollo comercial', 4],
    ['International Marketing Coordinator', 6],
    ['Técnico de Marketing Digital, Captación', 3],
    ['Marketing Coordinator Intern', 1],
    ['Coordinador/a de ventas- Telemarketing- Gran Vía', 1],
    ['Trade Marketing Specialist', 4],
    ['Ecommerce Marketplace Manager', 2],
    ['Retail and Trade Marketing Internships', 1],
    ['Digital Marketing Seo Specialist – French Market', 1],
    ['Salesforce Analyst', -3],
  ])('%s → %i', (titulo, encaje) => expect(amy(titulo)).toBe(encaje));

  it('"intern" no penaliza "international"', () => {
    expect(scoreTitle('International Marketing', rules('amy')).etiquetas.map((t) => t.label)).not.toContain('Prácticas');
  });
});

describe('scoreTitle (perfil psicología)', () => {
  it('las ofertas de psicología suben por encima del ruido de otras profesiones, sin etiqueta propia', () => {
    const psico = scoreTitle('Psicólogo/a infantojuvenil', rules('psicologia'));
    expect(psico.encaje).toBeGreaterThan(scoreTitle('Abogado/a fiscal', rules('psicologia')).encaje);
    expect(psico.etiquetas).toEqual([]);
  });

  it('ignora acentos al comparar', () => {
    expect(scoreTitle('Psicóloga para víctimas de violencia sexual', rules('psicologia')).encaje).toBe(6);
  });

  it('penaliza lo que exige habilitación sanitaria u otra profesión', () => {
    expect(scoreTitle('Psicóloga sanitaria adultos', rules('psicologia')).encaje).toBe(-1);
    expect(scoreTitle('Integrador/a social (suplencia)', rules('psicologia')).encaje).toBe(-3);
  });
});

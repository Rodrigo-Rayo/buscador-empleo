import { describe, expect, it } from 'vitest';
import { canonicalJobUrl, extractJobId, parseLinkedIn as parseSearchResult } from '../src/sources/linkedin';

const BASE = 'https://es.linkedin.com/jobs/view/';
const result = (title: string, slug: string, snippet = '') => ({ title, link: `${BASE}${slug}`, snippet });

describe('extractJobId', () => {
  it('extrae el ID de una URL con slug', () => {
    expect(extractJobId(`${BASE}dev-at-acme-4012345678?trk=x`)).toBe('4012345678');
  });
  it('extrae el ID de una URL numérica', () => {
    expect(extractJobId('https://www.linkedin.com/jobs/view/4012345678/')).toBe('4012345678');
  });
  it('extrae el ID de currentJobId', () => {
    expect(extractJobId('https://www.linkedin.com/jobs/search/?currentJobId=4012345678')).toBe('4012345678');
  });
  it('devuelve null si no es una oferta', () => {
    expect(extractJobId('https://www.linkedin.com/in/alguien')).toBeNull();
  });
});

// Todos los títulos, slugs y snippets son resultados reales devueltos por Serper.
describe('parseSearchResult', () => {
  it('"Título en Empresa — Ubicación | Empleos de LinkedIn"', () => {
    const job = parseSearchResult(
      result('Angular Developer Junior en Hays — Madrid | Empleos de LinkedIn', 'angular-developer-junior-at-hays-4464533097'),
    );
    expect(job).toEqual({
      id: '4464533097',
      titulo: 'Angular Developer Junior',
      empresa: 'Hays',
      ubicacion: 'Madrid',
      enlace: canonicalJobUrl('4464533097'),
      portal: 'linkedin',
    });
  });

  it('"Título en Empresa - Empleos - LinkedIn" con ubicación del snippet', () => {
    const job = parseSearchResult(
      result(
        'Desarrollador/a FullStack Jr. en PrimeIT España - Empleos - LinkedIn',
        'desarrollador-a-fullstack-jr-at-primeit-espa%C3%B1a-4464348683',
        'Solicita el puesto de Desarrollador/a FullStack Jr. en PrimeIT España en Madrid: Jornada completa ...',
      ),
    );
    expect(job).toMatchObject({ titulo: 'Desarrollador/a FullStack Jr.', empresa: 'PrimeIT España', ubicacion: 'Madrid' });
  });

  it('respeta guiones y " en " internos del título', () => {
    const job = parseSearchResult(
      result('Junior Backend Developer - Madrid en Fidesmo - LinkedIn', 'junior-backend-developer-madrid-at-fidesmo-4465992188'),
    );
    expect(job).toMatchObject({ titulo: 'Junior Backend Developer - Madrid', empresa: 'Fidesmo' });
  });

  it('"Título - Empresa - LinkedIn" y detecta remoto en el snippet', () => {
    const job = parseSearchResult(
      result('Frontend Engineer (Remote) - Hired - LinkedIn', 'frontend-engineer-remote-at-hired-4466352133', 'Trabajo en remoto'),
    );
    expect(job).toMatchObject({ titulo: 'Frontend Engineer (Remote)', empresa: 'Hired', ubicacion: 'Remoto' });
  });

  it('título sin empresa: la toma del slug (decodificando acentos) sin cortar el título', () => {
    const job = parseSearchResult(
      result('React Developer | 100% REMOTO - LinkedIn', 'react-developer-100%25-remoto-at-primeit-espa%C3%B1a-4469921385'),
    );
    expect(job).toMatchObject({ titulo: 'React Developer | 100% REMOTO', empresa: 'Primeit España' });
  });

  it('no confunde un guion del título con la empresa', () => {
    const job = parseSearchResult(
      result(
        'Programador/a Full Stack - Java/ Javascript/ PL-SQL/ Inglés - LinkedIn',
        'programador-a-full-stack-java-javascript-pl-sql-ingl%C3%A9s-at-metrica-4460978864',
      ),
    );
    expect(job).toMatchObject({ titulo: 'Programador/a Full Stack - Java/ Javascript/ PL-SQL/ Inglés', empresa: 'Metrica' });
  });

  it('empresa truncada por Google: el título queda intacto', () => {
    const job = parseSearchResult(
      result(
        'Fullstack Developer React.js/ Node.js en PrimeIT España ... - LinkedIn',
        'fullstack-developer-react-js-node-js-at-primeit-espa%C3%B1a-4467746548',
        'Madrid',
      ),
    );
    expect(job).toMatchObject({ titulo: 'Fullstack Developer React.js/ Node.js', empresa: 'PrimeIT España', ubicacion: 'Madrid' });
  });

  it('reconoce la empresa aunque el slug lleve sufijo societario (S.L.U.)', () => {
    const job = parseSearchResult(
      result(
        'Desarrollador/a Backend .NET en FERCHAU Spain — Madrid',
        'desarrollador-a-backend-net-at-ferchau-spain-s-l-u-4466248363',
      ),
    );
    expect(job).toMatchObject({ titulo: 'Desarrollador/a Backend .NET', empresa: 'FERCHAU Spain', ubicacion: 'Madrid' });
  });

  it('"X busca personal para el cargo de Y en Z"', () => {
    const job = parseSearchResult(
      result('Meep busca personal para el cargo de Backend Engineer en España', 'backend-engineer-at-meep-4468251296'),
    );
    expect(job).toMatchObject({ empresa: 'Meep', titulo: 'Backend Engineer', ubicacion: 'España' });
  });

  it('"busca" truncado: el puesto sale del slug', () => {
    const job = parseSearchResult(
      result('Scalian Spain busca personal para el cargo de Programador/a ...', 'programador-a-easyvista-at-scalian-spain-4464329649'),
    );
    expect(job).toMatchObject({ empresa: 'Scalian Spain', titulo: 'Programador A Easyvista', ubicacion: 'No especificada' });
  });

  it('título truncado sin empresa: usa el slug', () => {
    const job = parseSearchResult(
      result(
        'FullStack Software Engineer (M/F/X)_React_Springboot_Inglés C1_ ...',
        'fullstack-software-engineer-m-f-x-react-springboot-at-bigzon-4470400049',
      ),
    );
    expect(job).toMatchObject({ titulo: 'Fullstack Software Engineer M F X React Springboot', empresa: 'Bigzon' });
  });

  it('formato en inglés "X hiring Y in Z"', () => {
    const job = parseSearchResult(
      result('Acme Corp hiring Frontend Developer in Madrid, Spain | LinkedIn', 'frontend-developer-at-acme-corp-4012345678'),
    );
    expect(job).toMatchObject({ empresa: 'Acme Corp', titulo: 'Frontend Developer', ubicacion: 'Madrid, Spain' });
  });

  it('snippet en inglés "Apply for X at Y in Z": toma la ubicación', () => {
    const job = parseSearchResult({
      title: 'Full-Stack .NET Angular Developer at Wire IT',
      link: 'https://www.linkedin.com/jobs/view/full-stack-net-angular-developer-at-wire-it-4471620773',
      snippet: 'Apply for Full-Stack .NET Angular Developer at Wire IT in European Union ... .NET Developer (C# / Angular) – Greece (Remote).',
    });
    expect(job).toMatchObject({ titulo: 'Full-Stack .NET Angular Developer', empresa: 'Wire IT', ubicacion: 'European Union' });
  });

  it('"Título at Empresa — Ubicación" (fichas en inglés)', () => {
    const job = parseSearchResult({
      title: 'Full Stack Engineer at Optimis Tech — European Union',
      link: 'https://www.linkedin.com/jobs/view/full-stack-engineer-at-optimis-tech-4471000001',
      snippet: '',
    });
    expect(job).toMatchObject({ titulo: 'Full Stack Engineer', empresa: 'Optimis Tech', ubicacion: 'European Union' });
  });

  it('quita el sufijo " - Jobs"', () => {
    const job = parseSearchResult({
      title: 'Senior Angular Developer (f/m/x) at AURENA Group - Jobs',
      link: 'https://www.linkedin.com/jobs/view/senior-angular-developer-f-m-x-at-aurena-group-4471000002',
      snippet: '',
    });
    expect(job).toMatchObject({ titulo: 'Senior Angular Developer (f/m/x)', empresa: 'AURENA Group' });
  });

  it('snippet en inglés con punto tras la ubicación', () => {
    const job = parseSearchResult({
      title: 'Senior Full-Stack Java/Angular Developer - Remote',
      link: 'https://www.linkedin.com/jobs/view/senior-full-stack-java-angular-developer-remote-european-candidates-at-all-european-careers-4470299441',
      snippet: 'Apply for Senior Full-Stack Java/Angular Developer - Remote - European candidates at All European Careers in European Union. Contract Mid-Senior level role.',
    });
    expect(job?.ubicacion).toBe('European Union');
  });

  it('URL sin slug ni título: valores por defecto', () => {
    const job = parseSearchResult({ title: '', link: 'https://www.linkedin.com/jobs/view/4012345678/', snippet: '' });
    expect(job).toMatchObject({ titulo: 'Sin título', empresa: 'Desconocida', ubicacion: 'No especificada' });
  });

  it('tolera slugs con % mal codificado', () => {
    const job = parseSearchResult(result('', 'dev-at-acme-100%-4012345678'));
    expect(job).toMatchObject({ titulo: 'Dev', empresa: 'Acme 100%' });
  });

  it('descarta resultados que no son ofertas', () => {
    expect(parseSearchResult({ title: 'Acme', link: 'https://www.linkedin.com/company/acme', snippet: '' })).toBeNull();
  });
});

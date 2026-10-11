import { describe, expect, it } from 'vitest';
import { SOURCES } from '../src/sources';
import { parseHacesfalta } from '../src/sources/hacesfalta';
import { parseIndeed } from '../src/sources/indeed';
import { parseInfoJobs } from '../src/sources/infojobs';
import { parseTecnoempleo } from '../src/sources/tecnoempleo';

// Todos los casos son resultados reales devueltos por Serper (septiembre 2026)
const r = (title: string, link: string, snippet = '') => ({ title, link, snippet });

describe('InfoJobs', () => {
  it('quita "Oferta de empleo:", el " en {ciudad}" final y los parámetros de la URL', () => {
    const job = parseInfoJobs(
      r(
        'Oferta de empleo: Psicólogo/a para Clínicas Origen en Madrid ...',
        'https://www.infojobs.net/madrid/psicologo-para-clinicas-origen-madrid-albufera/of-i32a29700154ab692a23a256327b794?applicationOrigin=search-new',
        'Trabaja de Psicólogo/a para Clínicas Origen en Madrid - Albufera en la empresa Origen - Ofertas Clínica. Envía tu curriculum vitae',
      ),
    );
    expect(job).toEqual({
      id: 'infojobs:32a29700154ab692a23a256327b794',
      titulo: 'Psicólogo/a para Clínicas Origen',
      empresa: 'Origen - Ofertas Clínica',
      ubicacion: 'Madrid',
      enlace: 'https://www.infojobs.net/madrid/psicologo-para-clinicas-origen-madrid-albufera/of-i32a29700154ab692a23a256327b794',
      portal: 'infojobs',
    });
  });

  it('empresa desde "X - Ofertas de trabajo" y remoto si lo dice el título', () => {
    const job = parseInfoJobs(
      r(
        'Analista Programador/a .Net MVC (100% Teletrabajo)',
        'http://www.infojobs.net/madrid/analista-programador-.net-mvc-100-teletrabajo/of-ie93975ddc841b2a5d34fb9c542d29b',
        'Net MVC (100% Teletrabajo). Second Window - Ofertas de trabajo. Second Window ...',
      ),
    );
    expect(job).toMatchObject({ empresa: 'Second Window', ubicacion: 'Remoto', enlace: expect.stringMatching(/^https:/) });
  });

  it('limpia empresas cortadas por Google ("Accom ..") y descarta las que solo son puntos', () => {
    const link = 'https://www.infojobs.net/madrid/coordinador-ventas/of-i83dd0f94784476a9d2';
    expect(parseInfoJobs(r('Coordinador/a de ventas', link, 'Trabaja de X en la empresa Accom ... Trabajar'))?.empresa).toBe('Accom');
    expect(parseInfoJobs(r('Psicólogo/a Social', link, 'Trabaja de X en la empresa ... Madrid'))?.empresa).toBe('Desconocida');
  });

  it('la ubicación sale de la URL aunque no sea Madrid', () => {
    const job = parseInfoJobs(
      r('Oferta de empleo: Programador/a .NET y Técnico/a de ...', 'https://www.infojobs.net/santa-cruz-de-tenerife/programador-.net-tecnico-sistemas/of-ief4fcac24d4e5a8a63b7e2d6dabbf2'),
    );
    expect(job).toMatchObject({ titulo: 'Programador/a .NET y Técnico/a de', ubicacion: 'Santa Cruz De Tenerife' });
  });

  it.each([
    'https://www.infojobs.net/ofertas-trabajo/programador-junior',
    'https://www.infojobs.net/grupo-despertares-salud-sl./em-i98565550525157671111101015234505913072',
  ])('descarta páginas que no son ofertas: %s', (link) => {
    expect(parseInfoJobs(r('Ofertas de trabajo de Programador junior', link))).toBeNull();
  });
});

describe('Indeed', () => {
  it('separa título y ubicación, y saca la empresa de la cabecera del snippet', () => {
    const job = parseIndeed(
      r(
        'Psicólogo/a, indefinido, CAEF - Madrid, Madrid provincia ...',
        'https://es.indeed.com/viewjob?jk=ae44f16125da8475',
        '... Psicólogo/a, indefinido, CAEF. Grupo 5. (parte de Clariane). ·. 3.0. Madrid, Madrid provincia. Detalles del empleo.',
      ),
    );
    expect(job).toEqual({
      id: 'indeed:ae44f16125da8475',
      titulo: 'Psicólogo/a, indefinido, CAEF',
      empresa: 'Grupo 5',
      ubicacion: 'Madrid',
      enlace: 'https://es.indeed.com/viewjob?jk=ae44f16125da8475',
      portal: 'indeed',
    });
  });

  it('remoto solo si la cabecera de la propia oferta dice Teletrabajo', () => {
    const header = 'ES- Analista Programador .Net Back. Devoteam Spain. ·. 3.5. 28006 Madrid, Madrid provincia. •. Teletrabajo. Detalles del empleo.';
    const remote = parseIndeed(r('ES- Analista Programador .Net Back - 28006 Madrid ...', 'https://es.indeed.com/viewjob?jk=d145ac7e81937017', header));
    expect(remote).toMatchObject({ titulo: 'ES- Analista Programador .Net Back', empresa: 'Devoteam Spain', ubicacion: 'Remoto' });

    const noise = '28037 Madrid, Madrid provincia ... Oferta de Empleo – Técnico/a de Sistemas | 100% Remoto. Modalidad: Teletrabajo';
    const onSite = parseIndeed(r('Fullstack .Net Cloud AWS - 28037 Madrid, Madrid provincia', 'https://es.indeed.com/viewjob?jk=2dd626003a968b22', noise));
    expect(onSite).toMatchObject({ titulo: 'Fullstack .Net Cloud AWS', ubicacion: 'Madrid' });
  });

  it('un guion que no precede a una ubicación es parte del título', () => {
    const job = parseIndeed(r('Application Support (.NET + SQL) - Hybrid Madrid (3-2)', 'https://es.indeed.com/viewjob?jk=324e538c03b59255'));
    expect(job).toMatchObject({ titulo: 'Application Support (.NET + SQL) - Hybrid Madrid (3-2)', ubicacion: 'No especificada' });
  });

  it('localidades de la provincia: "Cercedilla, Madrid provincia" → Cercedilla', () => {
    const job = parseIndeed(r('Psicólogo/a - Cercedilla, Madrid provincia', 'https://es.indeed.com/viewjob?jk=c677c56948ad2f45'));
    expect(job?.ubicacion).toBe('Cercedilla');
  });

  it('descarta URLs que no son fichas', () => {
    expect(parseIndeed(r('Empleos de psicólogo', 'https://es.indeed.com/q-psicologo-empleos.html'))).toBeNull();
  });
});

describe('Tecnoempleo', () => {
  it('saca empresa y ubicación del snippet y quita la empresa del título', () => {
    const job = parseTecnoempleo(
      r(
        'Analista Programador .Net Back - Devoteam',
        'https://www.tecnoempleo.com/analista-programador-net-back-devoteam/net-c/rf-6bd211dc6249c3b3c944',
        'Oferta de Empleo analista programador .net back en Madrid, Devoteam - Tecnoempleo.com con conocimientos .net, c#.',
      ),
    );
    expect(job).toEqual({
      id: 'tecnoempleo:6bd211dc6249c3b3c944',
      titulo: 'Analista Programador .Net Back',
      empresa: 'Devoteam',
      ubicacion: 'Madrid',
      enlace: 'https://www.tecnoempleo.com/analista-programador-net-back-devoteam/net-c/rf-6bd211dc6249c3b3c944',
      portal: 'tecnoempleo',
    });
  });

  it('título con el formato del snippet ("Oferta de Empleo x en remoto, UST")', () => {
    const job = parseTecnoempleo(
      r('Oferta de Empleo java developer kafka en remoto, UST', 'https://www.tecnoempleo.com/java-developer-kafka-ust/microservicios-spring-boot/rf-5fc3152a32d51392b949'),
    );
    expect(job).toMatchObject({ titulo: 'Java developer kafka', empresa: 'UST', ubicacion: 'Remoto' });
  });

  it('no toma texto de la descripción como empresa', () => {
    const job = parseTecnoempleo(
      r(
        'Data Engineer with Snowflake and DBT - UST',
        'https://www.tecnoempleo.com/data-engineer-with-snowflake-and-dbt-ust/python-azure-data-factory/rf-0d031796d2bc432f9242',
        'Oferta de Empleo data engineer with snowflake and dbt en remoto ... - Real Work Life Balance measures (flexibility, WFH or remote work policy, compacted hours .',
      ),
    );
    expect(job?.empresa).toBe('Desconocida');
  });

  it.each(['https://www.tecnoempleo.com/ofertas-trabajo/madrid/c%23', 'https://www.tecnoempleo.com/david-romero-castano.mpt'])(
    'descarta categorías y perfiles: %s',
    (link) => expect(parseTecnoempleo(r('48 Ofertas Trabajo de c# en Madrid', link))).toBeNull(),
  );
});

describe('Hacesfalta', () => {
  it('"ubicación | área | puesto"', () => {
    const job = parseHacesfalta(
      r('Madrid | Trabajo social | Trabajador/trabajadora social', 'https://www.hacesfalta.org/oportunidades/remuneradas/detalle/trabajadortrabajadora-social/277123'),
    );
    expect(job).toEqual({
      id: 'hacesfalta:277123',
      titulo: 'Trabajador/trabajadora social',
      empresa: 'Desconocida',
      ubicacion: 'Madrid',
      enlace: 'https://www.hacesfalta.org/oportunidades/remuneradas/detalle/trabajadortrabajadora-social/277123',
      portal: 'hacesfalta',
    });
  });

  it('sin puesto en el título: lo saca del slug ("psicologoa" → "Psicologo/a")', () => {
    const job = parseHacesfalta(r('Trabajo en Rivas-VaciaMadrid - Madrid | Psicología', 'https://www.hacesfalta.org/oportunidades/remuneradas/detalle/psicologoa/277651'));
    expect(job).toMatchObject({ titulo: 'Psicologo/a', ubicacion: 'Rivas-VaciaMadrid' });
  });

  it('dos partes sin "Trabajo en": no toma el puesto como ubicación', () => {
    const job = parseHacesfalta(
      r('Psicólogo/a | Punto de Encuentro Familiar', 'https://www.hacesfalta.org/oportunidades/remuneradas/detalle/psicologoa-punto-de-encuentro-familiar/277700'),
    );
    expect(job).toMatchObject({ titulo: 'Psicologo/a Punto De Encuentro Familiar', ubicacion: 'No especificada' });
  });

  it('"puesto - Trabajo en ubicación" y solo puesto', () => {
    const base = 'https://www.hacesfalta.org/oportunidades/remuneradas/detalle/x/1';
    expect(parseHacesfalta(r('Preparador/a laboral - Trabajo en Madrid', base))).toMatchObject({ titulo: 'Preparador/a laboral', ubicacion: 'Madrid' });
    expect(parseHacesfalta(r('Trabajador/a social – coordinador/a de hogares de acogida', base))).toMatchObject({
      titulo: 'Trabajador/a social – coordinador/a de hogares de acogida',
      ubicacion: 'No especificada',
    });
  });

  it('descarta los listados', () => {
    expect(parseHacesfalta(r('Ofertas de trabajo en ONG', 'https://www.hacesfalta.org/oportunidades/remuneradas/default.aspx?pageIndex=59'))).toBeNull();
  });
});

describe('LinkedIn Internacional', () => {
  it('reutiliza el parser de LinkedIn pero marca su propio portal', () => {
    const job = SOURCES.linkedin_intl.parse(
      r(
        'Full-Stack .NET Angular Developer at Wire IT',
        'https://www.linkedin.com/jobs/view/full-stack-net-angular-developer-at-wire-it-4471620773',
        'Apply for Full-Stack .NET Angular Developer at Wire IT in European Union ...',
      ),
    );
    expect(job).toMatchObject({ id: '4471620773', ubicacion: 'European Union', portal: 'linkedin_intl' });
  });

  it('busca fuera de es.linkedin.com (ese ya lo cubre el portal de LinkedIn)', () => {
    expect(SOURCES.linkedin_intl.site).toBe('site:linkedin.com/jobs/view -site:es.linkedin.com');
  });

  it('descarta resultados que no son ofertas', () => {
    expect(SOURCES.linkedin_intl.parse(r('Acme', 'https://www.linkedin.com/company/acme'))).toBeNull();
  });
});

describe('SOURCES', () => {
  it('cada portal está registrado con su propio id y parser', () => {
    for (const [id, source] of Object.entries(SOURCES)) {
      expect(source.id).toBe(id);
      expect(source.site).toMatch(/^site:/);
    }
  });
});

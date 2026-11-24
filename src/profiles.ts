import type { ScoringRule } from './relevance';
import type { ListingId, SearchPortalId } from './sources';

export interface ReportPage {
  /** Nombre corto en la barra que enlaza las páginas de todas las personas */
  readonly navLabel: string;
  readonly documentTitle: string;
  readonly kicker: readonly string[];
  readonly heading: string;
  readonly emphasis: string;
  /** Texto del filtro que muestra solo las ofertas con encaje positivo */
  readonly matchLabel: string;
  /** El filtro anterior viene marcado al abrir la página (se puede desmarcar para ver el resto) */
  readonly onlyMatchByDefault?: boolean;
  /** Reglas de encaje sobre el título (en minúsculas y sin acentos): ordenan y etiquetan las ofertas */
  readonly scoring: readonly ScoringRule[];
}

export interface SearchProfile {
  readonly id: string;
  /** Pausado: `npm start` lo salta (se puede lanzar a mano con `npm run buscar:<id>`) */
  readonly paused: boolean;
  /** Su página se publica en GitHub Pages para esa persona: sin barra que enlace las búsquedas de los demás */
  readonly published?: boolean;
  /** Una búsqueda (1 crédito) por palabra clave y portal */
  readonly keywords: readonly string[];
  readonly portals: readonly SearchPortalId[];
  /** Restringe algunas palabras clave a parte de los portales (donde no traen nada se ahorra el crédito) */
  readonly keywordPortals?: Readonly<Record<string, readonly SearchPortalId[]>>;
  /** Webs cuyo listado se lee entero (sin Google ni créditos); se guardan solo las ofertas que encajan con el perfil */
  readonly listings?: readonly ListingId[];
  /** Si no está vacío, el resultado debe contener al menos uno (p. ej. nivel junior/mid). Solo en portales que lo admiten */
  readonly requiredTerms: readonly string[];
  readonly locationTerms: readonly string[];
  /** Se excluyen por título (-intitle:), no por el cuerpo de la página */
  readonly excludedTitleTerms: readonly string[];
  /** Sobrescribe DATE_RESTRICT para este perfil */
  readonly dateRestrict?: string;
  readonly outputFile: string;
  readonly reportFile: string;
  readonly page: ReportPage;
}

// Encaje con su stack, común a la búsqueda en España y a la internacional.
// Otros stacks (Java, Python, PHP...) no restan: está abierto a aprender
const STACK_RULES: readonly ScoringRule[] = [
  { label: 'Angular', pattern: 'angular', points: 3 },
  { label: '.NET / C#', pattern: 'c#|\\.net\\b|\\bnet\\b', points: 3 },
  { label: 'Full Stack', pattern: 'full ?-?stack', points: 2 },
  { label: 'Mid', pattern: '\\bmid\\b|middle|semi ?-?senior|\\bssr\\b', points: 1 },
  { label: 'TypeScript', pattern: 'typescript', points: 1 },
  { label: 'SQL', pattern: 'sql', points: 1 },
  { label: 'Node / React / Next', pattern: 'node|react|next\\.?js', points: 1 },
  { label: 'Remoto / híbrido', pattern: 'remot|teletrabajo|hibrid|hybrid', points: 1 },
  // 0 puntos: solo avisa de que puede pedir más años, sin enterrar ofertas mejor pagadas
  { label: 'Senior', pattern: '\\bsenior\\b|\\bsr\\b', points: 0 },
  { label: 'Junior', pattern: '\\bjunior\\b|\\bjr\\b', points: -2 },
];

const NOT_DEVELOPMENT: ScoringRule = {
  label: 'No es desarrollo',
  pattern: '\\bqa\\b|devsecops|devops|\\bbi\\b|marketing|campaign|comercial|ventas|sales|soporte|tienda',
  points: -3,
};

const DESARROLLO: SearchProfile = {
  id: 'desarrollo',
  paused: true,
  // SQL/MySQL no se usan como palabra clave: traen sobre todo puestos de DBA y soporte, y ya aparecen en las ofertas .NET.
  // "Fullstack" y "Full Stack" van por separado: Google busca la frase exacta
  keywords: ['Angular', 'C#', '.NET', 'Fullstack', 'Full Stack', 'Frontend', 'Backend', 'TypeScript', 'Node.js', 'React'],
  portals: ['linkedin', 'infojobs', 'indeed', 'tecnoempleo'],
  // Sin filtro de nivel: con 3 años encajan ofertas mid y muchas "senior" en España (piden 3+ años)
  requiredTerms: [],
  locationTerms: ['Madrid', 'remoto', 'remote', 'teletrabajo', 'híbrido', 'hybrid'],
  excludedTitleTerms: ['lead', 'principal', 'staff', 'manager', 'head', 'director', 'becario', 'prácticas', 'internship', 'trainee'],
  outputFile: 'ofertas.json',
  reportFile: 'ofertas.html',
  page: {
    navLabel: 'Desarrollo',
    documentTitle: 'Ofertas de desarrollo',
    kicker: ['Buscador de empleo', 'Madrid · Híbrido · Remoto'],
    heading: 'Ofertas',
    emphasis: 'full-stack · mid',
    matchLabel: 'Solo con tu stack',
    scoring: [...STACK_RULES, { label: 'Presencial', pattern: 'presencial|on-?site', points: -1 }, NOT_DEVELOPMENT],
  },
};

// Segundo frente: empresas extranjeras en remoto (LinkedIn fuera de España, en inglés)
const INTERNACIONAL: SearchProfile = {
  id: 'internacional',
  paused: true,
  keywords: ['Angular', '.NET', 'C#', 'Full Stack', 'Fullstack', 'TypeScript', 'Node.js'],
  portals: ['linkedin_intl'],
  requiredTerms: ['remote'],
  locationTerms: ['Europe', 'EMEA', 'European Union', 'Spain'],
  excludedTitleTerms: ['lead', 'principal', 'staff', 'manager', 'head', 'director', 'intern', 'trainee'],
  outputFile: 'ofertas-internacional.json',
  reportFile: 'ofertas-internacional.html',
  page: {
    navLabel: 'Remoto internacional',
    documentTitle: 'Ofertas en remoto internacional',
    kicker: ['Buscador de empleo', 'Remoto · Europa'],
    heading: 'Ofertas',
    emphasis: 'remote · Europe',
    matchLabel: 'Solo con tu stack',
    scoring: [
      ...STACK_RULES,
      { label: 'Europa / España', pattern: 'europe|europa|emea|\\beu\\b|spain|espana', points: 2 },
      // Remotos que solo contratan en esos países: desde España no se puede
      {
        label: 'Solo América / Asia',
        pattern: '\\bus\\b|\\busa\\b|united states|latam|latin america|colombia|mexico|brazil|argentin|ecuador|india',
        points: -3,
      },
      // Tareas sueltas pagadas por horas (entrenamiento de IA y similares), no puestos de trabajo
      { label: 'Por horas (gig)', pattern: '/hr\\b|per hour|/hour', points: -3 },
      NOT_DEVELOPMENT,
    ],
  },
};

// Marilyn: Grado en Psicología (Ecuador, sin homologar: no puede colegiarse) y Máster en Sexología, Educación Sexual y
// Asesoría Sexológica (UCJC). Experiencia de sexóloga y educadora sexual (Madrid Salud, asociación Deslenguando, ESPACIO,
// donde coordina talleres y forma a formadoras) y en selección, formación y clima laboral; ahora en Eurofirms.
// Prioridad: sexología; además, puestos puente con jornada completa (igualdad, violencia, selección, formación).
// La sexología no es profesión regulada: puede hacer educación sexual, talleres y asesoramiento no clínico, pero no
// terapia clínica ni puestos que pidan colegiación o habilitación sanitaria (PGS).
// Prueba de noviembre de 2026 (un mes, 4 portales): casi no hay ofertas con "sexóloga" en el título (0 en InfoJobs en toda
// España), y "sexual" o "sexualidad" a secas traen ruido ("sin discriminación por orientación sexual" en cualquier oferta).
// Descartadas por no traer nada: "sexóloga", "afectivo-sexual", "educación sexual", "educador sexual", "técnico de
// intervención social", "técnico de juventud", "talleres". Sustituye al antiguo perfil "psicologia"
const MARILYN: SearchProfile = {
  id: 'marilyn',
  paused: false,
  published: true,
  keywords: [
    'sexólogo',
    'sexología',
    'terapia sexual',
    'salud sexual',
    'violencia sexual',
    'violencia de género',
    'agente de igualdad',
    'psicólogo',
    'técnico de selección',
    'consultor de selección',
    'técnico de formación',
  ],
  // Tecnoempleo no: solo publica ofertas de informática. Hacesfalta no se busca por Google: su listado de Madrid se
  // lee entero y con la ficha completa (ver listings), que es donde salen VIH, LGTBI y lo afectivo-sexual
  portals: ['linkedin', 'infojobs', 'indeed'],
  keywordPortals: {
    'sexólogo': ['linkedin'],
    'sexología': ['linkedin'],
    'terapia sexual': ['linkedin'],
    'salud sexual': ['linkedin'],
    'violencia sexual': ['linkedin'],
    'agente de igualdad': ['linkedin'],
    'psicólogo': ['linkedin', 'indeed'],
    'técnico de selección': ['linkedin', 'infojobs', 'indeed'],
    'consultor de selección': ['linkedin'],
    'técnico de formación': ['linkedin'],
  },
  // Sin créditos. Eduso no: casi todo pide el título de Educación Social (prueba de noviembre de 2026: 0 de 276)
  listings: ['hacesfalta_madrid'],
  requiredTerms: [],
  locationTerms: ['Madrid', 'online', 'remoto', 'teletrabajo'],
  excludedTitleTerms: ['psiquiatra', 'prácticas', 'becario', 'becaria'],
  // Hay muy pocas ofertas del sector: ventana de un mes
  dateRestrict: 'm1',
  outputFile: 'ofertas-marilyn.json',
  reportFile: 'ofertas-marilyn.html',
  page: {
    navLabel: 'Marilyn · Sexología',
    documentTitle: 'Ofertas para Marilyn',
    kicker: ['Buscador de empleo · Marilyn', 'Madrid · Online'],
    heading: 'Ofertas',
    emphasis: 'sexología · igualdad · selección',
    matchLabel: 'Solo las que encajan con su perfil',
    onlyMatchByDefault: true,
    scoring: [
      {
        label: 'Sexología',
        pattern: 'sexolog|afectivo|educacion sexual|educador.{0,3} sexual|salud sexual|terapia sexual|\\bvih\\b|\\bits\\b',
        points: 5,
        // En la descripción de Eduso: educadores o técnicos que dan "educación afectivo-sexual" sin decirlo en el título
        alsoDescription: true,
      },
      // "Diversidad funcional" es discapacidad: solo cuenta la sexual o de género
      {
        label: 'LGTBI / diversidad',
        pattern: 'lgtb|lgbt|diversidad sexual|diversidad afectivo|diversidad de genero|identidad de genero|\\btrans\\b',
        points: 3,
      },
      { label: 'Igualdad / violencia', pattern: 'violencia|igualdad|\\bvg\\b|victima|mujer', points: 3 },
      { label: 'Pareja', pattern: 'pareja', points: 2 },
      { label: 'Selección / RRHH', pattern: 'seleccion|recruit|rrhh|recursos humanos|talent', points: 2 },
      // Sus CV: formación de formadoras, talleres y formación en igualdad y diversidad en empresas
      { label: 'Formación', pattern: 'tecnic[oa].{0,4} de formacion|formador|formacion de formador', points: 2 },
      { label: '', pattern: 'juventud|joven|taller|formador|docente|psicolog', points: 1 },
      // Sin homologar no puede colegiarse: lo sanitario, clínico o forense no es para ella
      { label: 'Pide colegiación', pattern: 'sanitari|\\bpgs\\b|clinic|forense|colegiad|psicoterapeut|\\bpir\\b', points: -4 },
      // En la descripción solo frases inequívocas: "sanitari" casaría con "ámbito sociosanitario"
      {
        label: 'Pide colegiación',
        pattern: 'colegiad|colegiacion|\\bpgs\\b|general sanitari|habilitacion sanitaria|habilitacion profesional',
        points: -4,
        alsoDescription: true,
      },
      // Eduso dice los estudios mínimos: muchas plazas son para quien tiene el título de Educación o Trabajo Social
      {
        label: 'Pide otra titulación',
        pattern:
          'estudios minimos:[^.]*(educador.{0,3} social|educacion social|trabajo social|trabajador.{0,3} social|integracion social|magisterio|enfermer|terapia ocupacional)',
        points: -3,
        alsoDescription: true,
      },
      {
        label: 'Otra profesión',
        // "en derecho\b": la carrera de Derecho, no "derechos humanos"
        pattern:
          'tienda|encargad|integrador|auxiliar|enfermer|abogad|en derecho\\b|monitor|cuidador|limpieza|ingenier|comercial|teleoperador|frigorista|calibracion|\\bprl\\b|terapeuta ocupacional|nomina',
        points: -3,
      },
    ],
  },
};

// Dos líneas de su CV: trabajo social (igualdad, violencia de género, protección internacional, inserción
// sociolaboral) y gestión de RRHH (selección, administración de personal; tiene un máster en Dirección de RRHH).
// Portales por palabra clave según una prueba con un mes de ofertas: donde no traían nada o solo ruido, se quitan.
// Descartadas por traer solo ruido: "agente/técnica/técnico de igualdad", "técnico de empleo", "proyectos sociales"
const TRABAJO_SOCIAL: SearchProfile = {
  id: 'gabi',
  paused: true,
  published: true,
  keywords: [
    'trabajador social',
    'trabajadora social',
    'trabajo social',
    'violencia de género',
    'protección internacional',
    'inserción sociolaboral',
    'orientador laboral',
    'técnico de selección',
    'técnico de recursos humanos',
    'administrativo de recursos humanos',
  ],
  // Hacesfalta: portal de empleo de ONG y fundaciones, donde se publica mucho trabajo social
  portals: ['linkedin', 'infojobs', 'indeed', 'hacesfalta'],
  keywordPortals: {
    'trabajador social': ['linkedin', 'infojobs', 'indeed'],
    'trabajadora social': ['indeed', 'hacesfalta'],
    'protección internacional': ['infojobs', 'indeed', 'hacesfalta'],
    'inserción sociolaboral': ['infojobs', 'hacesfalta'],
    'orientador laboral': ['linkedin', 'indeed'],
    'técnico de selección': ['linkedin', 'infojobs', 'indeed'],
    'técnico de recursos humanos': ['linkedin', 'indeed'],
    'administrativo de recursos humanos': ['linkedin', 'infojobs'],
  },
  requiredTerms: [],
  // La primera es la principal (la única que usa Hacesfalta); el resto, Guadalajara y los pueblos de camino a Madrid
  locationTerms: ['Madrid', 'Guadalajara', 'Alcalá de Henares', 'Azuqueca', 'Torrejón', 'remoto', 'teletrabajo'],
  excludedTitleTerms: ['becario', 'becaria', 'prácticas'],
  dateRestrict: 'm1',
  outputFile: 'ofertas-gabi.json',
  reportFile: 'ofertas-gabi.html',
  page: {
    navLabel: 'Gabi · Trabajo social',
    documentTitle: 'Ofertas para Gabi',
    kicker: ['Buscador de empleo · Gabi', 'Madrid · Guadalajara · Remoto'],
    heading: 'Ofertas',
    emphasis: 'trabajo social · igualdad · RRHH',
    matchLabel: 'Solo las que encajan con su perfil',
    // Las búsquedas de pocos días traen mucho relleno de otras profesiones: de entrada se ve solo lo que encaja
    onlyMatchByDefault: true,
    scoring: [
      { label: 'Trabajo social', pattern: 'trabajador.{0,3} social|trabajadora social|trabajo social', points: 3 },
      { label: 'Igualdad / violencia de género', pattern: 'igualdad|violencia|\\bvg\\b|mujer', points: 3 },
      { label: 'Protección internacional', pattern: 'proteccion internacional|refugiad|migra|asilo|acogida', points: 2 },
      { label: 'Inserción sociolaboral', pattern: 'insercion|sociolaboral|orientador|prospeccion|empleabilidad', points: 2 },
      { label: 'RRHH / selección', pattern: 'recursos humanos|rrhh|seleccion|administracion de personal|relaciones laborales', points: 2 },
      // Sin etiqueta: gestión de proyectos sociales sube un poco
      { label: '', pattern: '\\bproyectos?\\b|\\bprogramas?\\b', points: 1 },
      // 0 puntos: solo avisa de la zona; si sumara, cualquier oferta de Torrejón o Alcalá pasaría el filtro
      { label: 'Guadalajara o cerca', pattern: 'guadalajara|alcala|azuqueca|torrejon|coslada', points: 0 },
      {
        label: 'Otra profesión',
        pattern:
          'educador|integrador|auxiliar|cuidador|gerocultor|limpieza|monitor|psicolog|enfermer|terapeuta|abogad|interprete|teleoperador|comercial',
        points: -3,
      },
    ],
  },
};

// Su CV: coordinación de marketing en retail (campañas promocionales, punto de venta), e-commerce, email marketing y
// marketing digital; más de 10 años de experiencia, máster en Marketing Digital y Analítico, grado en Negocios
// Internacionales, inglés B1. Portales por palabra clave según una prueba con un mes de ofertas.
// Descartadas por traer ruido: "marketing analyst" (remotos de EE. UU.), "analista de marketing", "marketing retail",
// "marketing y ventas", "e-commerce manager" (repetía lo de "ecommerce")
const MARKETING: SearchProfile = {
  id: 'amy',
  paused: true,
  published: true,
  keywords: [
    'coordinador de marketing',
    'coordinadora de marketing',
    'marketing coordinator',
    'responsable de marketing',
    'técnico de marketing',
    'marketing internacional',
    'trade marketing',
    'ecommerce',
    'marketing digital',
    'email marketing',
    'brand manager',
    'especialista en marketing',
  ],
  // Hacesfalta y Tecnoempleo no: apenas publican marketing
  portals: ['linkedin', 'infojobs', 'indeed'],
  // InfoJobs e Indeed casi no tienen estos puestos con el título exacto: solo donde la prueba trajo ofertas
  keywordPortals: {
    'coordinador de marketing': ['linkedin'],
    'coordinadora de marketing': ['linkedin'],
    'marketing coordinator': ['linkedin'],
    'responsable de marketing': ['linkedin'],
    'marketing internacional': ['linkedin'],
    'trade marketing': ['linkedin', 'indeed'],
    ecommerce: ['linkedin', 'infojobs'],
    'marketing digital': ['linkedin', 'indeed'],
    'email marketing': ['linkedin', 'infojobs'],
    'brand manager': ['linkedin'],
    'especialista en marketing': ['linkedin', 'infojobs'],
  },
  requiredTerms: [],
  locationTerms: ['Madrid', 'remoto', 'remote', 'teletrabajo', 'híbrido'],
  // "senior" no se excluye: con su experiencia encajan puestos senior
  excludedTitleTerms: ['director', 'directora', 'head', 'prácticas', 'becario', 'becaria', 'internship', 'intern'],
  // Explícita: en GitHub Actions no hay .env con DATE_RESTRICT y buscaría sin límite de fecha
  dateRestrict: 'm1',
  outputFile: 'ofertas-amy.json',
  reportFile: 'ofertas-amy.html',
  page: {
    navLabel: 'Amy · Marketing',
    documentTitle: 'Ofertas para Amy',
    kicker: ['Buscador de empleo · Amy', 'Madrid · Remoto'],
    heading: 'Ofertas',
    emphasis: 'marketing · trade · e-commerce',
    matchLabel: 'Solo las que encajan con su perfil',
    onlyMatchByDefault: true,
    scoring: [
      { label: 'Coordinación', pattern: 'coordinad|coordinator', points: 3 },
      { label: 'Trade / retail', pattern: 'trade marketing|retail|punto de venta|shopper|store marketing|\\btrade\\b', points: 3 },
      { label: 'E-commerce', pattern: 'e-?commerce|marketplace|tienda online', points: 2 },
      { label: 'Marketing digital / CRM', pattern: 'digital|email|crm|automation|growth|performance', points: 2 },
      { label: 'Internacional', pattern: 'internacional|international|export|comercio exterior', points: 2 },
      { label: 'Marca', pattern: 'brand|\\bmarca\\b', points: 1 },
      // Sin etiqueta: solo sube las de marketing por encima del ruido
      { label: '', pattern: 'marketing', points: 1 },
      { label: 'Prácticas', pattern: 'practicas|becari|\\bbeca\\b|\\binterns?\\b|internship|intake|graduate|student', points: -3 },
      // Inglés B1: puestos para otros mercados piden su idioma nativo
      { label: 'Otro idioma', pattern: 'french|german|italian|dutch|nordic|frances|aleman|italiano', points: -2 },
      { label: 'Fuera de España', pattern: '\\bus remote|\\busa\\b|united states|latam|/hr\\b|per hour', points: -3 },
      {
        label: 'No es marketing',
        pattern: 'telemarketing|teleoperador|inmobiliari|puerta fria|vendedor|captador|comercial de calle|salesforce|reporting',
        points: -3,
      },
    ],
  },
};

export const PROFILES: readonly SearchProfile[] = [DESARROLLO, INTERNACIONAL, MARILYN, TRABAJO_SOCIAL, MARKETING];

export interface Search {
  readonly portal: SearchPortalId;
  readonly keyword: string;
}

/** Una búsqueda (1 crédito) por cada palabra clave en cada uno de sus portales. */
export function searchesFor(profile: SearchProfile): readonly Search[] {
  return profile.keywords.flatMap((keyword) =>
    (profile.keywordPortals?.[keyword] ?? profile.portals).map((portal) => ({ portal, keyword })),
  );
}

/** Perfiles pedidos por línea de comandos; sin argumentos, todos (o solo los activos si `activeOnly`). */
export function selectProfiles(ids: readonly string[], { activeOnly = false } = {}): readonly SearchProfile[] {
  if (ids.length === 0) return activeOnly ? PROFILES.filter((profile) => !profile.paused) : PROFILES;
  const unknown = ids.filter((id) => !PROFILES.some((profile) => profile.id === id));
  if (unknown.length > 0) {
    const valid = PROFILES.map((profile) => profile.id).join(', ');
    throw new Error(`Perfil desconocido: ${unknown.join(', ')}. Perfiles disponibles: ${valid}.`);
  }
  return PROFILES.filter((profile) => ids.includes(profile.id));
}

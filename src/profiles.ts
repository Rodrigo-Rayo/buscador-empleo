import type { ScoringRule } from './relevance';
import type { PortalId } from './sources';

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
  /** Una búsqueda (1 crédito) por palabra clave y portal */
  readonly keywords: readonly string[];
  readonly portals: readonly PortalId[];
  /** Restringe algunas palabras clave a parte de los portales (donde no traen nada se ahorra el crédito) */
  readonly keywordPortals?: Readonly<Record<string, readonly PortalId[]>>;
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

const PSICOLOGIA: SearchProfile = {
  id: 'psicologia',
  paused: true,
  // "educación sexual" se descartó: en LinkedIn solo devuelve ofertas no relacionadas
  keywords: [
    'psicólogo',
    'psicóloga',
    'sexología',
    'sexualidad',
    'terapia sexual',
    'terapia de pareja',
    'violencia sexual',
    'violencia de género',
  ],
  // Tecnoempleo no: solo publica ofertas de informática (las que mencionan "psicólogo" lo hacen en los beneficios)
  portals: ['linkedin', 'infojobs', 'indeed', 'hacesfalta'],
  requiredTerms: [],
  locationTerms: ['Madrid', 'online', 'remoto', 'teletrabajo'],
  excludedTitleTerms: ['psiquiatra'],
  // Hay pocas ofertas del sector: se amplía la ventana a un mes
  dateRestrict: 'm1',
  outputFile: 'ofertas-psicologia.json',
  reportFile: 'ofertas-psicologia.html',
  page: {
    navLabel: 'Psicología',
    documentTitle: 'Ofertas de psicología y sexología',
    kicker: ['Buscador de empleo', 'Madrid · Online'],
    heading: 'Ofertas',
    emphasis: 'psicología & sexología',
    matchLabel: 'Solo sexología / violencia',
    scoring: [
      { label: 'Sexología / pareja', pattern: 'sexolog|sexual|pareja', points: 3 },
      { label: 'Violencia de género', pattern: 'violencia|pmorvg|victima', points: 2 },
      // Sin etiqueta: solo sube las de psicología por encima del ruido de otras profesiones
      { label: '', pattern: 'psicolog', points: 1 },
      // Sin el Máster en Psicología General Sanitaria no se puede ejercer terapia clínica
      { label: 'Pide sanitaria', pattern: 'sanitari', points: -2 },
      { label: 'Otra profesión', pattern: 'tienda|encargad|trabajador.{0,3} social|integrador|educador', points: -3 },
    ],
  },
};

// Dos líneas de su CV: trabajo social (igualdad, violencia de género, protección internacional, inserción
// sociolaboral) y gestión de RRHH (selección, administración de personal; tiene un máster en Dirección de RRHH).
// Portales por palabra clave según una prueba con un mes de ofertas: donde no traían nada o solo ruido, se quitan.
// Descartadas por traer solo ruido: "agente/técnica/técnico de igualdad", "técnico de empleo", "proyectos sociales"
const TRABAJO_SOCIAL: SearchProfile = {
  id: 'gabi',
  paused: false,
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

const MARKETING: SearchProfile = {
  id: 'amy',
  paused: true,
  keywords: [
    'coordinador de marketing',
    'coordinadora de marketing',
    'marketing coordinator',
    'responsable de marketing',
    'técnico de marketing',
    'marketing internacional',
  ],
  // Hacesfalta y Tecnoempleo no: apenas publican marketing
  portals: ['linkedin', 'infojobs', 'indeed'],
  requiredTerms: [],
  locationTerms: ['Madrid', 'remoto', 'remote', 'teletrabajo', 'híbrido'],
  excludedTitleTerms: ['director', 'directora', 'head', 'senior'],
  outputFile: 'ofertas-amy.json',
  reportFile: 'ofertas-amy.html',
  page: {
    navLabel: 'Amy · Marketing',
    documentTitle: 'Ofertas de marketing',
    kicker: ['Buscador de empleo · Amy', 'Madrid · Remoto'],
    heading: 'Ofertas',
    emphasis: 'coordinación de marketing',
    matchLabel: 'Solo coordinación / internacional',
    scoring: [
      { label: 'Coordinación', pattern: 'coordinad|coordinator', points: 3 },
      // Grado en Negocios Internacionales
      { label: 'Internacional', pattern: 'internacional|international|export|global|trade', points: 2 },
      { label: 'Marketing', pattern: 'marketing', points: 1 },
      { label: 'Prácticas', pattern: 'practicas|becari|\\bintern\\b|internship', points: -2 },
      {
        label: 'No es marketing',
        pattern: 'telemarketing|teleoperador|inmobiliari|puerta fria|vendedor|captador|comercial de calle',
        points: -3,
      },
    ],
  },
};

export const PROFILES: readonly SearchProfile[] = [DESARROLLO, INTERNACIONAL, PSICOLOGIA, TRABAJO_SOCIAL, MARKETING];

export interface Search {
  readonly portal: PortalId;
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

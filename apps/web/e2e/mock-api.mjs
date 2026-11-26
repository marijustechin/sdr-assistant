import { createServer } from 'node:http';

/**
 * Deterministic stand-in for the NestJS API, used only by the Playwright suite.
 *
 * The real API starts paid Exa/DeepSeek calls on `POST /research`, so E2E tests
 * must never touch it. The Next server is started with `API_URL` pointing here.
 *
 * Stateful jobs advance one step per `GET /research/:id` (first call = server
 * render, following calls = browser polling), which is exactly what the polling
 * tests need. `POST /__reset` restores the initial state between tests.
 */

const PORT = Number(process.env.MOCK_API_PORT ?? 4100);

const CREATED_AT = '2026-11-14T08:51:00.000Z';

function product(overrides) {
  return {
    id: 'p-abachi',
    name: 'Thermo Abachi Cladding',
    description:
      'Thermally modified Abachi cladding designed primarily for sauna interiors and premium wall or ceiling applications.',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

const LONG_DESCRIPTION = Array.from(
  { length: 60 },
  (value, index) =>
    `Line ${index + 1}: thermally modified timber for demanding interiors.`,
).join('\n');

const PRODUCTS = [
  product(),
  product({
    id: 'p-long',
    name: 'Industrial Catalogue',
    description: LONG_DESCRIPTION,
  }),
];

function job(overrides) {
  return {
    id: 'job-done',
    productId: 'p-abachi',
    country: 'Lithuania',
    status: 'QUEUED',
    stage: null,
    result: null,
    error: null,
    lastHeartbeatAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

/**
 * Synthetic research results for the SDR-007 rendered scenarios.
 *
 * Every value below is invented test data. Domains use the reserved `.test`
 * suffix and contacts are clearly synthetic. The shapes mirror the persisted
 * production contract (`schemaVersion: 1`) and the documented historical
 * variations; no private research file or row is copied.
 */
const SYNTHETIC_COMPANIES = [
  {
    domain: 'alpha-sauna.test',
    registrableDomain: 'alpha-sauna.test',
    status: 'profiled',
    company: {
      name: 'Alpha Sauna OÜ',
      legalName: 'Alpha Sauna OÜ',
      code: 'EE12345678',
      vat: 'EE12345678',
      address: 'Synthetic 1',
      city: 'Tallinn',
      country: 'Estonia',
      emails: [
        {
          value: 'sales@alpha-sauna.test',
          label: 'sales',
          sourceUrl: 'https://alpha-sauna.test/contact',
        },
        {
          value: 'info@alpha-sauna.test',
          label: 'general',
          sourceUrl: 'https://alpha-sauna.test/contact',
        },
      ],
      phones: [
        {
          value: '+372 6000 0001',
          normalised: '+37260000001',
          label: 'sales',
          sourceUrl: 'https://alpha-sauna.test/contact',
        },
      ],
      contactFormUrl: 'https://alpha-sauna.test/contact',
      sources: ['https://alpha-sauna.test', 'https://alpha-sauna.test/about'],
    },
    offers: [
      {
        id: '03-0001',
        item: 'Synthetic sauna bench',
        verdict: 'a',
        traits: {
          medienos_rusis: 'confirmed',
          apdorojimas: 'differs',
        },
        pageIds: ['03-0001'],
        sourceUrl: 'https://alpha-sauna.test/bench',
        marketFrom03: {
          status: 'target',
          note: 'Synthetic stage-03 note.',
          sourceUrl: 'https://alpha-sauna.test/bench',
          quote: 'We deliver this bench across Germany.',
        },
        market: {
          status: 'target',
          resolvedBy: 'evidence',
          basis: '03',
          evidence: [
            {
              channel: 'delivery',
              direction: 'allows',
              scope: 'domain',
              appliesTo: ['03-0001'],
              quote: 'Delivery to Germany is available.',
              sourceUrl: 'https://alpha-sauna.test/delivery',
            },
          ],
          channels: {
            delivery: 'open',
            pickup: 'unknown',
            purchase: 'unknown',
          },
          conflict: false,
        },
        prices: [
          {
            amount: 1250,
            currency: 'EUR',
            unit: 'm2',
            vatIncluded: true,
            priceType: 'from',
            variant: 'Bench A',
            quote: 'From 1,250 EUR per m².',
            sourceUrl: 'https://alpha-sauna.test/bench',
          },
          {
            amount: 1490,
            currency: 'EUR',
            unit: 'pc',
            vatIncluded: true,
            priceType: 'exact',
            variant: 'Bench B',
            quote: 'Synthetic per-piece price.',
            sourceUrl: 'https://alpha-sauna.test/bench-piece',
          },
        ],
      },
      {
        id: '03-0002',
        item: 'Synthetic bench cushion',
        verdict: 'b',
        traits: {},
        pageIds: [],
        sourceUrl: 'https://alpha-sauna.test/cushion',
        marketFrom03: 'Legacy-style market note for this offer.',
        market: {
          status: 'unclear',
          resolvedBy: 'none',
          evidence: [],
          channels: {},
          conflict: false,
        },
        prices: [],
      },
    ],
  },
  {
    domain: 'beta-wood.test',
    registrableDomain: 'beta-wood.test',
    status: 'needs_review',
    company: {
      name: null,
      legalName: null,
      code: null,
      vat: null,
      address: null,
      city: null,
      country: null,
      emails: [
        {
          value: 'INFO@alpha-sauna.test',
          label: null,
          sourceUrl: 'https://beta-wood.test/contact',
        },
      ],
      phones: [],
      contactFormUrl: null,
      sources: ['https://beta-wood.test'],
    },
    offers: [
      {
        id: '03-0003',
        item: 'Synthetic cedar panel',
        verdict: 'b',
        traits: {},
        pageIds: ['03-0003'],
        marketFrom03: 'Synthetic historical market note.',
        market: {
          status: 'unclear',
          resolvedBy: 'none',
          evidence: [],
          channels: {},
          conflict: false,
        },
        prices: [],
      },
    ],
  },
  {
    domain: 'gamma-heat.test',
    registrableDomain: 'gamma-heat.test',
    status: 'profiled',
    company: {
      name: 'Gamma Heat GmbH',
      legalName: 'Gamma Heat GmbH',
      code: 'DE12345678',
      vat: 'DE123456789',
      address: 'Synthetic 2',
      city: 'Berlin',
      country: 'Germany',
      emails: [],
      phones: [
        {
          value: '+49 30 0000002',
          normalised: '+49300000002',
          label: 'general',
          sourceUrl: 'https://gamma-heat.test/contact',
        },
      ],
      contactFormUrl: 'data:text/html,<script>alert(1)</script>',
      sources: ['https://gamma-heat.test'],
    },
    offers: [
      {
        id: '03-0004',
        item: 'Synthetic heater',
        verdict: 'b',
        traits: { leistung: 'unknown' },
        pageIds: ['03-0004'],
        sourceUrl: 'javascript:alert(1)',
        marketFrom03: {
          status: 'unclear',
          note: 'Synthetic note',
          sourceUrl: 'https://gamma-heat.test/note',
          quote: null,
        },
        market: {
          status: 'unclear',
          resolvedBy: 'evidence',
          evidence: [
            {
              channel: 'purchase',
              direction: 'restricts',
              scope: 'offer',
              appliesTo: ['03-0004'],
              quote: 'Synthetic restriction quote',
              sourceUrl: 'https://gamma-heat.test/restriction',
            },
          ],
          channels: {
            delivery: 'open',
            pickup: 'closed',
            purchase: 'closed',
          },
          conflict: true,
        },
        prices: [
          {
            amount: 0,
            currency: 'EUR',
            unit: 'pc',
            vatIncluded: false,
            priceType: 'exact',
            variant: null,
            quote: 'Synthetic zero price.',
            sourceUrl: 'https://gamma-heat.test/price',
          },
        ],
      },
    ],
  },
  {
    domain: 'delta-klamp.test',
    registrableDomain: 'delta-klamp.test',
    status: 'needs_review',
    company: {
      name: 'Delta Klamp',
      legalName: null,
      code: null,
      vat: null,
      address: null,
      city: null,
      country: null,
      emails: [],
      phones: [],
      contactFormUrl: null,
      sources: [],
    },
    offers: [
      {
        id: '03-0005',
        item: 'Synthetic clamp',
        verdict: 'b',
        traits: {},
        pageIds: [],
        sourceUrl: 'https://delta-klamp.test/clamp',
        marketFrom03: {
          status: 'target',
          note: null,
          sourceUrl: 'https://delta-klamp.test/clamp',
          quote: 'Synthetic quote',
        },
        market: {
          status: 'target',
          resolvedBy: 'evidence',
          evidence: [],
          channels: {},
          conflict: false,
        },
        prices: [
          {
            amount: 89,
            currency: 'USD',
            unit: 'm',
            vatIncluded: null,
            priceType: 'exact',
            variant: 'Clamp set',
            quote: 'Synthetic USD price.',
            sourceUrl: 'https://delta-klamp.test/price',
          },
        ],
      },
    ],
  },
  {
    domain: 'epsilon-puu.test',
    registrableDomain: 'epsilon-puu.test',
    status: 'rejected',
    company: {
      name: null,
      legalName: null,
      code: null,
      vat: null,
      address: null,
      city: null,
      country: null,
      emails: [],
      phones: [],
      contactFormUrl: null,
      sources: ['https://epsilon-puu.test'],
    },
    offers: [],
  },
  {
    domain: 'zeta-profile.test',
    registrableDomain: 'zeta-profile.test',
    status: 'error',
    error: {
      code: 'fetch_failed',
      message: 'Synthetic fetch failure.',
    },
    company: {
      name: 'Zeta Profile',
      legalName: null,
      code: null,
      vat: null,
      address: null,
      city: null,
      country: null,
      emails: [],
      phones: [],
      contactFormUrl: null,
      sources: [],
    },
    offers: [],
  },
];

const SYNTHETIC_SUMMARY = {
  domains: 6,
  reused: 0,
  firstCallOnly: 4,
  secondCall: 1,
  secondCallFailed: 0,
  errors: 1,
  newFetches: 5,
  newLlmCalls: 6,
  newPromptTokens: 1200,
  newCompletionTokens: 300,
};

const LONG_SYNTHETIC_QUOTE = 'Synthetic long evidence text. '.repeat(800);

function syntheticManyCompanies() {
  return Array.from({ length: 60 }, (value, index) => {
    const number = index + 1;

    return {
      domain: `company-${number}.test`,
      registrableDomain: `company-${number}.test`,
      status: 'profiled',
      company: {
        name: `Synthetic Company ${number}`,
        legalName: null,
        code: null,
        vat: null,
        address: null,
        city: null,
        country: null,
        emails:
          index % 2 === 0
            ? [
                {
                  value: `sales@company-${number}.test`,
                  label: 'sales',
                  sourceUrl: `https://company-${number}.test/contact`,
                },
              ]
            : [],
        phones: [],
        contactFormUrl: null,
        sources: [`https://company-${number}.test`],
      },
      offers: [
        {
          id: `03-${String(number).padStart(4, '0')}`,
          item: `Synthetic offer ${number}`,
          verdict: 'b',
          traits: {
            trait_family: index % 2 === 0 ? 'confirmed' : 'unknown',
          },
          pageIds: [],
          sourceUrl: `https://company-${number}.test/offer`,
          marketFrom03: {
            status: 'unclear',
            note: null,
            sourceUrl: `https://company-${number}.test/offer`,
            quote: index === 59 ? LONG_SYNTHETIC_QUOTE : 'Synthetic quote',
          },
          market: {
            status: 'unclear',
            resolvedBy: 'none',
            evidence: [],
            channels: {},
            conflict: false,
          },
          prices: [],
        },
      ],
    };
  });
}

const READABLE_MALFORMED_RESULT = {
  domain: 'malformed-ok.test',
  registrableDomain: 'malformed-ok.test',
  status: 'profiled',
  company: {
    name: 'Readable Company',
    legalName: null,
    code: null,
    vat: null,
    address: null,
    city: null,
    country: null,
    emails: [],
    phones: [],
    contactFormUrl: null,
    sources: [],
  },
  offers: [
    {
      id: '03-0090',
      item: 'Readable offer',
      verdict: 'b',
      traits: {},
      pageIds: [],
      sourceUrl: 'https://malformed-ok.test/offer',
      marketFrom03: null,
      market: {
        status: 'unclear',
        resolvedBy: 'none',
        evidence: [],
        channels: {},
        conflict: false,
      },
      prices: [],
    },
  ],
};

const RESULT_JOBS = {
  'job-many': job({
    id: 'job-many',
    productId: 'p-long',
    country: 'Netherlands',
    status: 'COMPLETED',
    createdAt: '2026-11-22T09:00:00.000Z',
    updatedAt: '2026-11-22T09:40:00.000Z',
    result: {
      schemaVersion: 1,
      completedThrough: '04-company-profiling',
      resultsPerQuery: 25,
      summary: { domains: 60, errors: 0 },
      companies: syntheticManyCompanies(),
    },
  }),
  'job-profiles': job({
    id: 'job-profiles',
    productId: 'p-long',
    country: 'Germany',
    status: 'COMPLETED',
    createdAt: '2026-11-21T09:00:00.000Z',
    updatedAt: '2026-11-21T09:30:00.000Z',
    result: {
      schemaVersion: 1,
      completedThrough: '04-company-profiling',
      resultsPerQuery: 25,
      summary: SYNTHETIC_SUMMARY,
      companies: SYNTHETIC_COMPANIES,
    },
  }),
  'job-malformed': job({
    id: 'job-malformed',
    productId: 'p-long',
    country: 'Poland',
    status: 'COMPLETED',
    createdAt: '2026-11-19T09:00:00.000Z',
    updatedAt: '2026-11-19T09:10:00.000Z',
    result: {
      schemaVersion: 1,
      completedThrough: '04-company-profiling',
      companies: [
        READABLE_MALFORMED_RESULT,
        { status: 'profiled' },
        { domain: 'broken.test' },
      ],
    },
  }),
  'job-empty': job({
    id: 'job-empty',
    productId: 'p-long',
    country: 'Lithuania',
    status: 'COMPLETED',
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T09:05:00.000Z',
    result: {
      schemaVersion: 1,
      completedThrough: '04-company-profiling',
      companies: [],
    },
  }),
  'job-history': job({
    id: 'job-history',
    productId: 'p-long',
    country: 'Hungary',
    status: 'COMPLETED',
    createdAt: '2026-11-17T09:00:00.000Z',
    updatedAt: '2026-11-17T09:05:00.000Z',
    result: {
      completedThrough: '02-page-collection',
      identificationPageCount: 12,
      selectedPageCount: 5,
      resultsPerQuery: 20,
    },
  }),
  'job-unsupported': job({
    id: 'job-unsupported',
    productId: 'p-long',
    country: 'Latvia',
    status: 'COMPLETED',
    createdAt: '2026-11-16T09:00:00.000Z',
    updatedAt: '2026-11-16T09:05:00.000Z',
    result: { unexpected: 'shape' },
  }),
  'job-null-result': job({
    id: 'job-null-result',
    productId: 'p-long',
    country: 'Estonia',
    status: 'COMPLETED',
    createdAt: '2026-11-15T09:00:00.000Z',
    updatedAt: '2026-11-15T09:05:00.000Z',
    result: null,
  }),
};

const STATIC_JOBS = {
  'job-done': job({
    status: 'COMPLETED',
    result: 'Company discovery finished: 12 companies, 9 with a domain.',
  }),
  'job-failed': job({
    id: 'job-failed',
    country: 'Hungary',
    status: 'FAILED',
    error: 'Company discovery failed: upstream timeout.',
  }),
  ...RESULT_JOBS,
};

/** Jobs that advance on every read. */
const dynamicJobs = {
  'job-complete': { calls: 0, productId: 'p-abachi', country: 'Lithuania' },
  'job-fails-run': { calls: 0, productId: 'p-abachi', country: 'Hungary' },
  'job-vanishes': { calls: 0, productId: 'p-abachi', country: 'Lithuania' },
};

const createdProducts = new Map();

/** Settings the mock API serves; `value` is what the real API would store. */
const SETTINGS = {
  'research.pageCollection.resultsPerQuery': 20,
};

const SETTINGS_GROUPS = [
  {
    key: 'research.pageCollection',
    label: 'Page collection',
    description:
      'Search and triage behaviour of stage 02 for new research runs.',
    items: [
      {
        key: 'research.pageCollection.resultsPerQuery',
        label: 'Results per query',
        description:
          'How many search results stage 02 requests per query per provider.',
        type: 'integer',
        default: 20,
        min: 1,
        max: 50,
      },
    ],
  },
];

function settingsPayload() {
  return {
    groups: SETTINGS_GROUPS.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        value: SETTINGS[item.key] ?? item.default,
      })),
    })),
  };
}

/**
 * Email accounts for the SDR-004 scenarios. Passwords are never stored or
 * served here: only the `*PasswordConfigured` flags exist, mirroring the API.
 */
const emailAccounts = new Map();
let emailAccountSequence = 0;

const EMAIL_ACCOUNT_FIELDS = [
  'name',
  'senderName',
  'emailAddress',
  'enabled',
  'smtpHost',
  'smtpPort',
  'smtpSecurity',
  'smtpUsername',
  'imapHost',
  'imapPort',
  'imapSecurity',
  'imapUsername',
];

function emailAccount(overrides) {
  return {
    id: 'email-account-1',
    name: 'Outreach mailbox',
    senderName: 'Sales Team',
    emailAddress: 'sales@example.test',
    enabled: true,
    smtpHost: 'smtp.example.test',
    smtpPort: 587,
    smtpSecurity: 'STARTTLS',
    smtpUsername: 'smtp-user',
    smtpPasswordConfigured: true,
    imapHost: 'imap.example.test',
    imapPort: 993,
    imapSecurity: 'TLS',
    imapUsername: 'imap-user',
    imapPasswordConfigured: true,
    smtpVerificationStatus: 'NOT_TESTED',
    smtpLastCheckedAt: null,
    smtpVerificationFailureCode: null,
    imapVerificationStatus: 'NOT_TESTED',
    imapLastCheckedAt: null,
    imapVerificationFailureCode: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

function createEmailAccount(body) {
  emailAccountSequence += 1;
  const now = new Date().toISOString();
  const created = emailAccount({
    id: `email-account-${emailAccountSequence}`,
    ...Object.fromEntries(
      EMAIL_ACCOUNT_FIELDS.filter((field) => Object.hasOwn(body, field)).map(
        (field) => [field, body[field]],
      ),
    ),
    smtpPasswordConfigured:
      typeof body.smtpPassword === 'string' && body.smtpPassword !== '',
    imapPasswordConfigured:
      typeof body.imapPassword === 'string' && body.imapPassword !== '',
    createdAt: now,
    updatedAt: now,
  });

  emailAccounts.set(created.id, created);

  return created;
}

function updateEmailAccount(existing, body) {
  const updated = { ...existing, updatedAt: new Date().toISOString() };
  const smtpConnectionChanged = connectionSettingsChanged(
    existing,
    body,
    'smtp',
  );
  const imapConnectionChanged = connectionSettingsChanged(
    existing,
    body,
    'imap',
  );

  for (const field of EMAIL_ACCOUNT_FIELDS) {
    if (Object.hasOwn(body, field)) {
      updated[field] = body[field];
    }
  }

  if (typeof body.smtpPassword === 'string' && body.smtpPassword !== '') {
    updated.smtpPasswordConfigured = true;
  }

  if (typeof body.imapPassword === 'string' && body.imapPassword !== '') {
    updated.imapPasswordConfigured = true;
  }

  // A protocol configuration change invalidates only that protocol's result,
  // exactly like the API. An empty password field changes nothing.
  if (smtpConnectionChanged) {
    updated.smtpVerificationStatus = 'NOT_TESTED';
    updated.smtpLastCheckedAt = null;
    updated.smtpVerificationFailureCode = null;
  }

  if (imapConnectionChanged) {
    updated.imapVerificationStatus = 'NOT_TESTED';
    updated.imapLastCheckedAt = null;
    updated.imapVerificationFailureCode = null;
  }

  emailAccounts.set(updated.id, updated);

  return updated;
}

function connectionSettingsChanged(existing, body, prefix) {
  const fields = [
    `${prefix}Host`,
    `${prefix}Port`,
    `${prefix}Security`,
    `${prefix}Username`,
  ];
  const fieldChanged = fields.some(
    (field) => Object.hasOwn(body, field) && body[field] !== existing[field],
  );
  const passwordChanged =
    typeof body[`${prefix}Password`] === 'string' &&
    body[`${prefix}Password`] !== '';

  return fieldChanged || passwordChanged;
}

const CONNECTION_TEST_DELAY_MS = Number(
  process.env.MOCK_CONNECTION_TEST_DELAY_MS ?? 600,
);
const ALLOWED_TEST_PORTS = { SMTP: [465, 587], IMAP: [993, 143] };

/** Deterministic verification outcome used by the rendered scenarios. */
function connectionOutcome(account, protocol) {
  const prefix = protocol === 'SMTP' ? 'smtp' : 'imap';
  const host = String(account[`${prefix}Host`] ?? '');
  const port = account[`${prefix}Port`];

  if (!ALLOWED_TEST_PORTS[protocol].includes(port)) {
    return { status: 'FAILED', failureCode: 'INVALID_CONFIGURATION' };
  }

  if (host.includes('fail')) {
    return { status: 'FAILED', failureCode: 'AUTHENTICATION_FAILED' };
  }

  if (host.includes('timeout')) {
    return { status: 'FAILED', failureCode: 'CONNECTION_TIMEOUT' };
  }

  if (host.includes('unsafe')) {
    return { status: 'FAILED', failureCode: 'UNSAFE_DESTINATION' };
  }

  return { status: 'VERIFIED', failureCode: null };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reset() {
  for (const state of Object.values(dynamicJobs)) {
    state.calls = 0;
  }

  createdProducts.clear();
  emailAccounts.clear();
  emailAccountSequence = 0;
  SETTINGS['research.pageCollection.resultsPerQuery'] = 20;
}

function send(response, status, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

function notFound(response, message) {
  send(response, 404, { statusCode: 404, message, error: 'Not Found' });
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      try {
        resolve(raw === '' ? {} : JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function allProducts() {
  return [...PRODUCTS, ...createdProducts.values()];
}

function findProduct(id) {
  return allProducts().find((item) => item.id === id);
}

function advance(id) {
  const state = dynamicJobs[id];

  if (state === undefined) {
    return null;
  }

  state.calls += 1;
  const updatedAt = new Date().toISOString();
  const common = {
    id,
    productId: state.productId,
    country: state.country,
    createdAt: CREATED_AT,
    updatedAt,
  };

  if (id === 'job-complete') {
    if (state.calls <= 1) {
      return job({ ...common, status: 'QUEUED' });
    }

    if (state.calls === 2) {
      return job({
        ...common,
        status: 'RUNNING',
        stage: 'product-identification',
      });
    }

    return job({
      ...common,
      status: 'COMPLETED',
      result: 'Company discovery finished: 12 companies, 9 with a domain.',
    });
  }

  if (state.calls <= 1) {
    return job({
      ...common,
      status: 'RUNNING',
      stage: 'product-identification',
    });
  }

  return job({
    ...common,
    status: 'FAILED',
    error: 'Company discovery failed: upstream timeout.',
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;
  const method = request.method ?? 'GET';

  if (method === 'POST' && path === '/__reset') {
    reset();
    return send(response, 200, { ok: true });
  }

  if (method === 'GET' && path === '/health') {
    return send(response, 200, { status: 'ok' });
  }

  if (method === 'GET' && path === '/settings') {
    return send(response, 200, settingsPayload());
  }

  if (method === 'PATCH' && path === '/settings') {
    const body = await readBody(request);
    const updates = body.updates;

    if (
      updates === null ||
      typeof updates !== 'object' ||
      Array.isArray(updates)
    ) {
      return send(response, 400, {
        statusCode: 400,
        message: ['updates must be an object'],
        error: 'Bad Request',
      });
    }

    const errors = [];
    const next = { ...SETTINGS };

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'research.pageCollection.resultsPerQuery') {
        errors.push(`Unknown setting key: ${key}`);
        continue;
      }

      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 50
      ) {
        errors.push(
          `Invalid value for ${key}: expected an integer between 1 and 50`,
        );
        continue;
      }

      next[key] = value;
    }

    if (errors.length > 0) {
      return send(response, 400, {
        statusCode: 400,
        message: errors,
        error: 'Bad Request',
      });
    }

    Object.assign(SETTINGS, next);

    return send(response, 200, settingsPayload());
  }

  if (method === 'GET' && path === '/email-accounts') {
    return send(response, 200, [...emailAccounts.values()]);
  }

  if (method === 'POST' && path === '/email-accounts') {
    const body = await readBody(request);

    // Deterministic failure path for the "API failure feedback" scenario.
    if (String(body.emailAddress ?? '').endsWith('@reject.test')) {
      return send(response, 422, {
        statusCode: 422,
        message: 'The mailbox provider refused this account.',
        error: 'Unprocessable Entity',
      });
    }

    return send(response, 201, createEmailAccount(body));
  }

  const connectionTestMatch =
    /^\/email-accounts\/([^/]+)\/test-(smtp|imap)$/.exec(path);

  if (connectionTestMatch !== null && method === 'POST') {
    const id = decodeURIComponent(connectionTestMatch[1]);
    const protocol = connectionTestMatch[2] === 'smtp' ? 'SMTP' : 'IMAP';
    const found = emailAccounts.get(id);

    if (found === undefined) {
      return notFound(response, 'Email account not found');
    }

    if (!found.enabled) {
      return send(response, 409, {
        statusCode: 409,
        message: 'Disabled email accounts cannot be tested.',
        error: 'Conflict',
      });
    }

    if (CONNECTION_TEST_DELAY_MS > 0) {
      await delay(CONNECTION_TEST_DELAY_MS);
    }

    // SMTP and IMAP are tested concurrently. Re-read the current account after
    // the delay and merge only this protocol's verification fields: a complete
    // snapshot taken before the delay would overwrite the other protocol's
    // fresh result.
    const current = emailAccounts.get(id);

    if (current === undefined) {
      return notFound(response, 'Email account not found');
    }

    const outcome = connectionOutcome(current, protocol);
    const now = new Date().toISOString();
    const prefix = protocol === 'SMTP' ? 'smtp' : 'imap';
    const updated = {
      ...current,
      [`${prefix}VerificationStatus`]: outcome.status,
      [`${prefix}LastCheckedAt`]: now,
      [`${prefix}VerificationFailureCode`]: outcome.failureCode,
      updatedAt: now,
    };

    emailAccounts.set(id, updated);

    return send(response, 200, {
      accountId: id,
      protocol,
      result: outcome.status,
      failureCode: outcome.failureCode,
      lastCheckedAt: now,
      account: updated,
    });
  }

  const emailAccountMatch = /^\/email-accounts\/([^/]+)$/.exec(path);

  if (emailAccountMatch !== null) {
    const id = decodeURIComponent(emailAccountMatch[1]);
    const found = emailAccounts.get(id);

    if (found === undefined) {
      return notFound(response, 'Email account not found');
    }

    if (method === 'GET') {
      return send(response, 200, found);
    }

    if (method === 'PATCH') {
      const body = await readBody(request);

      return send(response, 200, updateEmailAccount(found, body));
    }
  }

  if (method === 'GET' && path === '/products') {
    return send(response, 200, allProducts());
  }

  if (method === 'POST' && path === '/products') {
    const body = await readBody(request);
    const created = product({
      id: 'p-created',
      name: String(body.name ?? 'Created product'),
      description: String(body.description ?? ''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    createdProducts.set(created.id, created);
    return send(response, 201, created);
  }

  const productMatch = /^\/products\/([^/]+)$/.exec(path);

  if (productMatch !== null) {
    const found = findProduct(decodeURIComponent(productMatch[1]));

    if (found === undefined) {
      return notFound(response, 'Product not found');
    }

    if (method === 'GET') {
      return send(response, 200, found);
    }

    if (method === 'PATCH') {
      const body = await readBody(request);
      const updated = {
        ...found,
        name: String(body.name ?? found.name),
        description: String(body.description ?? found.description),
        updatedAt: new Date().toISOString(),
      };
      createdProducts.set(updated.id, updated);
      return send(response, 200, updated);
    }
  }

  if (method === 'GET' && path === '/research') {
    return send(response, 200, Object.values(STATIC_JOBS));
  }

  if (method === 'POST' && path === '/research') {
    const body = await readBody(request);
    const id = body.country === 'Hungary' ? 'job-fails-run' : 'job-complete';

    dynamicJobs[id].calls = 0;

    return send(response, 202, { jobId: id, status: 'QUEUED' });
  }

  const resumeMatch = /^\/research\/([^/]+)\/resume$/.exec(path);

  if (resumeMatch !== null && method === 'POST') {
    const id = decodeURIComponent(resumeMatch[1]);
    const state = dynamicJobs[id];

    if (state === undefined) {
      return send(response, 409, {
        statusCode: 409,
        message: 'Research is already completed.',
        error: 'Conflict',
      });
    }

    state.calls = 0;

    return send(response, 202, { jobId: id, status: 'RUNNING' });
  }

  const researchMatch = /^\/research\/([^/]+)$/.exec(path);

  if (researchMatch !== null && method === 'GET') {
    const id = decodeURIComponent(researchMatch[1]);

    if (Object.hasOwn(STATIC_JOBS, id)) {
      return send(response, 200, STATIC_JOBS[id]);
    }

    // Served once (the server render), then gone: the first browser poll gets a
    // 404, which is exactly the "polling stopped" case the UI must announce.
    if (id === 'job-vanishes') {
      dynamicJobs[id].calls += 1;

      return dynamicJobs[id].calls >= 2
        ? notFound(response, 'Job not found')
        : send(
            response,
            200,
            job({ id, productId: dynamicJobs[id].productId, status: 'QUEUED' }),
          );
    }

    const advanced = advance(id);

    return advanced === null
      ? notFound(response, 'Job not found')
      : send(response, 200, advanced);
  }

  return notFound(response, `No route for ${method} ${path}`);
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`mock api listening on http://127.0.0.1:${PORT}\n`);
});

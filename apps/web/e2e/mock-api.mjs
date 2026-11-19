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

function reset() {
  for (const state of Object.values(dynamicJobs)) {
    state.calls = 0;
  }

  createdProducts.clear();
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

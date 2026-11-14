import 'server-only';

/**
 * Server-only configuration.
 *
 * Never import this module from a Client Component: `API_URL` is a server
 * environment variable, and the browser must talk to same-origin `/api/*`
 * route handlers instead (the API does not enable CORS).
 */
export const apiUrl = (process.env.API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

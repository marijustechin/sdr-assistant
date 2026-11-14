/**
 * Browser entry point of the `research` entity.
 *
 * Client Components import this module, never `./index` — the barrel re-exports
 * server-only code (`server-only` turns that into a build error) and would pull
 * `API_URL` into the client bundle.
 */
export { fetchResearchStatus } from './api/research.client';

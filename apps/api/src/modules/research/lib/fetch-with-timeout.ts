export type TimeoutRequestOptions = {
  label: string;
  timeoutMs: number;
};

/**
 * `fetch` with a deadline.
 *
 * A third-party call that never answers must fail instead of holding the
 * research job in RUNNING forever. The signal also bounds reading the response
 * body. A request that times out is reported as a plain `Error` carrying the
 * call's label, so the message stored in `Research.error` says which provider
 * gave up — not just "the operation was aborted". A body read cut off by the
 * same deadline surfaces the platform's own timeout error.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  { label, timeoutMs }: TimeoutRequestOptions,
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (signal.aborted) {
      throw new Error(`${label} timed out after ${timeoutMs} ms`, {
        cause: error,
      });
    }

    throw error;
  }
}

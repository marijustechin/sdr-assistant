import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';

import {
  SafeHttpError,
  readResponse,
  resolvePublicAddresses,
} from '../../src/modules/lead-qualification/lead-qualification.http.js';

describe('SDR-007A bounded HTTP response handling', () => {
  it('caps the response by bytes and terminates an oversized stream early', async () => {
    const response = Readable.from([
      Buffer.alloc(6, 0x61),
      Buffer.alloc(20, 0x62),
    ]) as unknown as IncomingMessage;
    Object.assign(response, { statusCode: 200, headers: {} });

    const result = await readResponse(response, 8);

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.body)).toBe(8);
    expect(result.body).toBe('aaaaaabb');
  });

  it('classifies a temporary DNS lookup failure as transient', async () => {
    const error = Object.assign(new Error('temporary DNS failure'), {
      code: 'EAI_AGAIN',
    });
    await expect(
      resolvePublicAddresses('alpha.test', async () => {
        throw error;
      }),
    ).rejects.toMatchObject({
      kind: 'DNS',
      transient: true,
    });
  });

  it('rejects unsafe destinations before any network request', async () => {
    await expect(
      resolvePublicAddresses('alpha.test', async () => [
        { address: '10.0.0.1', family: 4 },
      ]),
    ).rejects.toBeInstanceOf(SafeHttpError);
  });
});

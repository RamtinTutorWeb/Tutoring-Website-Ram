import type { IncomingMessage } from 'node:http';

/**
 * Reads the unparsed request body. Webhook signature checks must run over the
 * exact bytes the provider sent, so never use `req.body` for those routes.
 *
 * Works with and without Vercel's request helpers: when helpers are enabled the
 * body has already been buffered and is replayed through `data`/`end` events.
 */
export function readRawBody(req: IncomingMessage, maxBytes = 1_000_000): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
      total += buf.length;
      if (total > maxBytes) {
        fail(new Error(`Request body exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', fail);
  });
}

/** First value of a (possibly multi-valued) header, or undefined. */
export function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

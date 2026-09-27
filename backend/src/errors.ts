import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

/** An error whose message is safe to return to the client. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** A required integration (Supabase, Clerk, ...) has no credentials. */
export class ConfigError extends Error {
  constructor(what: string) {
    super(`${what} is not configured`);
    this.name = 'ConfigError';
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = () => new HttpError(401, 'Unauthorized');
export const forbidden = () => new HttpError(403, 'Forbidden');
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);
export const conflict = (message: string) => new HttpError(409, message);

function zodMessage(err: ZodError): string {
  const issue = err.issues[0];
  if (!issue) return 'Invalid request body';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: zodMessage(err) });
    return;
  }
  // body-parser: malformed JSON or oversized body.
  const type = (err as { type?: unknown }).type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(400).json({ error: 'Request body too large' });
    return;
  }
  if (err instanceof ConfigError) {
    console.error(`${req.method} ${req.path}: ${err.message}`);
    res.status(500).json({ error: err.message });
    return;
  }
  console.error(`${req.method} ${req.path} failed:`, err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'Internal server error' });
};

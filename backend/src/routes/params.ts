import type { Request } from 'express';
import { notFound } from '../errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** `:id` route param as a uuid; anything else can't exist, so 404. */
export function uuidParam(req: Request, what: string): string {
  const id = req.params['id'];
  if (typeof id !== 'string' || !isUuid(id)) throw notFound(what);
  return id;
}

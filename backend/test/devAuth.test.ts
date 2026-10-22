import { afterEach, describe, expect, it } from 'vitest';
import { devAuthEnabled, env } from '../src/env.js';

// env is read once at import; these tests flip fields on the shared object and restore them.
const saved = { ...env, clerk: { ...env.clerk }, supabase: { ...env.supabase } };
afterEach(() => Object.assign(env, saved, { clerk: { ...saved.clerk }, supabase: { ...saved.supabase } }));

describe('devAuthEnabled', () => {
  const local = () => {
    env.devAuth = true;
    env.isProduction = false;
    env.clerk.publishableKey = undefined;
    env.clerk.secretKey = undefined;
    env.supabase.url = 'http://127.0.0.1:54321';
  };

  it('is on only with DEV_AUTH, no Clerk, not production, local Supabase', () => {
    local();
    expect(devAuthEnabled()).toBe(true);
  });
  it('is off without DEV_AUTH', () => {
    local();
    env.devAuth = false;
    expect(devAuthEnabled()).toBe(false);
  });
  it('is off in production', () => {
    local();
    env.isProduction = true;
    expect(devAuthEnabled()).toBe(false);
  });
  it('is off when Clerk is configured', () => {
    local();
    env.clerk.publishableKey = 'pk';
    env.clerk.secretKey = 'sk';
    expect(devAuthEnabled()).toBe(false);
  });
  it('is off against a remote Supabase', () => {
    local();
    env.supabase.url = 'https://abc.supabase.co';
    expect(devAuthEnabled()).toBe(false);
    env.supabase.url = 'http://localhost.evil.com';
    expect(devAuthEnabled()).toBe(false);
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { auth, state } from './fakes.js';

const app = createApp();

describe('auth gating', () => {
  it('serves /health and /content without auth', async () => {
    const health = await request(app).get('/health').expect(200);
    expect(health.body).toEqual({ ok: true, configured: { clerk: true, supabase: true, resend: true, calendly: true } });
    const content = await request(app).get('/content').expect(200);
    expect(content.body.selectableOptions.contactMethods).toEqual(['Email', 'Phone', 'WhatsApp']);
  });

  it.each([
    ['get', '/me'],
    ['patch', '/me'],
    ['get', '/requests'],
    ['get', '/bookings'],
    ['get', '/learner-courses'],
    ['post', '/learner-courses'],
    ['get', '/assessments'],
    ['post', '/assessments'],
    ['get', '/admin/users'],
    ['put', '/content'],
    ['patch', '/requests/00000000-0000-4000-8000-000000000001'],
  ] as const)('%s %s without a session -> 401', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('rejects an unverifiable token as signed out', async () => {
    await request(app).get('/me').set('Authorization', 'Bearer garbage').expect(401);
  });

  it.each([
    ['get', '/admin/users'],
    ['put', '/content'],
    ['patch', '/requests/00000000-0000-4000-8000-000000000001'],
    ['patch', '/learner-courses/00000000-0000-4000-8000-000000000001'],
  ] as const)('%s %s as a student -> 403', async (method, path) => {
    const res = await request(app)[method](path).set(auth('user_student')).send({ status: 'accepted' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('lets an admin list users', async () => {
    await request(app).get('/me').set(auth('user_student')).expect(200);
    const res = await request(app).get('/admin/users').set(auth('user_admin')).expect(200);
    expect(res.body.map((p: { id: string }) => p.id)).toContain('user_student');
  });

  it('GET /me upserts the profile from Clerk and mirrors role changes', async () => {
    const res = await request(app).get('/me').set(auth('user_student')).expect(200);
    expect(res.body).toMatchObject({ id: 'user_student', email: 'student@test.dev', fullName: 'Sam Student', role: 'student' });
    expect(state.profiles.get('user_student')?.role).toBe('student');

    state.profiles.set('user_student', { ...state.profiles.get('user_student')!, role: 'admin' });
    const again = await request(app).get('/me').set(auth('user_student')).expect(200);
    expect(again.body.role).toBe('student');
  });

  it('PATCH /me updates name and phone only', async () => {
    const res = await request(app)
      .patch('/me')
      .set(auth('user_student'))
      .send({ fullName: '  New Name ', phone: '', role: 'admin' })
      .expect(200);
    expect(res.body).toMatchObject({ fullName: 'New Name', phone: null, role: 'student' });
  });

  it('students only see their own requests; admins see all', async () => {
    await request(app).post('/requests').send({ name: 'Guest', email: 'guest@x.dev' }).expect(201);
    await request(app).post('/requests').set(auth('user_student')).send({ name: 'Sam', email: 'student@test.dev' }).expect(201);

    const mine = await request(app).get('/requests').set(auth('user_student')).expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].studentId).toBe('user_student');

    const all = await request(app).get('/requests').set(auth('user_admin')).expect(200);
    expect(all.body).toHaveLength(2);
  });

  it('guards /admin/calendly/register-webhook with x-admin-token', async () => {
    await request(app).post('/admin/calendly/register-webhook').expect(401);
    await request(app).post('/admin/calendly/register-webhook').set('x-admin-token', 'wrong').expect(401);
    // Right token, but no Calendly PAT configured in tests -> 500 with a clear message.
    const res = await request(app).post('/admin/calendly/register-webhook').set('x-admin-token', 'admin-token-test');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/CALENDLY_PERSONAL_ACCESS_TOKEN/);
  });

  it('applies the CORS allowlist', async () => {
    const ok = await request(app).get('/health').set('Origin', 'https://tutorpro.test');
    expect(ok.headers['access-control-allow-origin']).toBe('https://tutorpro.test');
    const local = await request(app).get('/health').set('Origin', 'http://localhost:5174');
    expect(local.headers['access-control-allow-origin']).toBe('http://localhost:5174');
    const evil = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});

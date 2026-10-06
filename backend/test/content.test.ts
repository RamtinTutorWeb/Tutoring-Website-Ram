import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { DEFAULT_PAGES } from '../src/lib/content.js';
import { auth, state } from './fakes.js';

const app = createApp();

describe('content pages', () => {
  it('GET /content returns default pages when nothing is stored', async () => {
    const res = await request(app).get('/content').expect(200);
    expect(res.body.pages).toEqual(DEFAULT_PAGES);
  });

  it('PUT /content replaces only the pages sent and keeps the rest', async () => {
    const about = {
      title: 'About Ramtin',
      intro: 'Hi',
      photoUrl: 'https://example.com/me.jpg',
      sections: [{ id: 's1', heading: 'Education', body: 'BSc Physics' }],
    };
    const res = await request(app).put('/content').set(auth('user_admin')).send({ pages: { about } }).expect(200);
    expect(res.body.pages.about).toEqual(about);
    expect(res.body.pages.home).toEqual(DEFAULT_PAGES.home);
    expect(state.settings.get('pages')).toMatchObject({ about });

    const booking = { calendlyUrl: 'https://calendly.com/ramtin/session', intro: 'Pick a time' };
    const next = await request(app).put('/content').set(auth('user_admin')).send({ pages: { booking } }).expect(200);
    expect(next.body.pages.booking).toEqual(booking);
    expect(next.body.pages.about).toEqual(about);
  });

  it('rejects non-admins and bad URLs', async () => {
    const booking = { calendlyUrl: 'https://calendly.com/x/y', intro: '' };
    await request(app).put('/content').send({ pages: { booking } }).expect(401);
    await request(app).put('/content').set(auth('user_student')).send({ pages: { booking } }).expect(403);

    for (const calendlyUrl of ['http://calendly.com/x', 'https://evil.com/calendly.com', 'javascript:alert(1)']) {
      await request(app).put('/content').set(auth('user_admin')).send({ pages: { booking: { calendlyUrl, intro: '' } } }).expect(400);
    }
    const home = { ...DEFAULT_PAGES.home, videoUrl: 'javascript:alert(1)' };
    await request(app).put('/content').set(auth('user_admin')).send({ pages: { home } }).expect(400);
  });

  it('fills missing or mistyped stored fields with defaults', async () => {
    state.settings.set('pages', { home: { title: 'Custom', videoUrl: 42 }, policy: 'nope' });
    const res = await request(app).get('/content').expect(200);
    expect(res.body.pages.home).toEqual({ ...DEFAULT_PAGES.home, title: 'Custom' });
    expect(res.body.pages.policy).toEqual(DEFAULT_PAGES.policy);
  });
});

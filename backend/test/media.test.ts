import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { auth, state } from './fakes.js';

const app = createApp();

describe('POST /media', () => {
  it('admins upload images and get a public URL', async () => {
    await request(app).post('/media?name=me.png').set('Content-Type', 'image/png').send(Buffer.from('png')).expect(401);
    await request(app).post('/media?name=me.png').set(auth('user_student')).set('Content-Type', 'image/png').send(Buffer.from('png')).expect(403);
    const res = await request(app)
      .post('/media?name=' + encodeURIComponent('My Photo.png'))
      .set(auth('user_admin'))
      .set('Content-Type', 'image/png')
      .send(Buffer.from('png'))
      .expect(201);
    expect(res.body.url).toMatch(/^https:\/\/storage\.test\/public\/site-media\/[0-9a-f-]{36}\/My-Photo\.png$/);
    expect(state.files.size).toBe(1);
  });

  it('rejects non-images and empty bodies', async () => {
    await request(app).post('/media?name=x.svg').set(auth('user_admin')).set('Content-Type', 'image/svg+xml').send('<svg/>').expect(400);
    await request(app).post('/media?name=x.html').set(auth('user_admin')).set('Content-Type', 'text/html').send('<b>').expect(400);
    await request(app).post('/media?name=x.png').set(auth('user_admin')).set('Content-Type', 'image/png').send(Buffer.alloc(0)).expect(400);
  });
});

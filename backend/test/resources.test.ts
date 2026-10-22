import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { safeFileName } from '../src/routes/resources.js';
import { auth, clerkUsers, fakeDb, sendMail, state } from './fakes.js';

const app = createApp();

const link = (overrides: Record<string, unknown> = {}) => ({
  title: 'Kinematics cheat sheet',
  kind: 'link',
  url: 'https://example.com/kinematics',
  ...overrides,
});

async function create(body: Record<string, unknown>) {
  return (await request(app).post('/resources').set(auth('user_admin')).send(body).expect(201)).body;
}

describe('resources', () => {
  it('only admins create, edit and delete', async () => {
    await request(app).post('/resources').send(link()).expect(401);
    await request(app).post('/resources').set(auth('user_student')).send(link()).expect(403);
    const created = await create(link());
    expect(created).toMatchObject({ title: 'Kinematics cheat sheet', kind: 'link', visibility: 'students', featured: false });
    expect(created).not.toHaveProperty('storagePath');

    await request(app).patch(`/resources/${created.id}`).set(auth('user_student')).send({ title: 'x' }).expect(403);
    await request(app).delete(`/resources/${created.id}`).set(auth('user_student')).expect(403);
    await request(app).delete(`/resources/${created.id}`).set(auth('user_admin')).expect(204);
    await request(app).delete(`/resources/${created.id}`).set(auth('user_admin')).expect(404);
    await request(app).delete('/resources/not-a-uuid').set(auth('user_admin')).expect(404);
  });

  it('validates targets: links need http(s) URLs, files need an uploaded object', async () => {
    await request(app).post('/resources').set(auth('user_admin')).send(link({ url: 'javascript:alert(1)' })).expect(400);
    await request(app).post('/resources').set(auth('user_admin')).send(link({ url: null })).expect(400);
    await request(app).post('/resources').set(auth('user_admin')).send({ title: 'f', kind: 'file' }).expect(400);
    await request(app)
      .post('/resources')
      .set(auth('user_admin'))
      .send({ title: 'f', kind: 'file', storagePath: '../../etc/passwd' })
      .expect(400);
  });

  it('visibility: public for everyone, students for signed-in, private for listed students', async () => {
    clerkUsers.set('user_other', { id: 'user_other', email: 'other@test.dev', fullName: 'Olly', phone: null, role: 'student' });
    const pub = await create(link({ title: 'Public', visibility: 'public', featured: true }));
    const students = await create(link({ title: 'Students' }));
    const priv = await create(link({ title: 'Private', visibility: 'private', studentIds: ['user_student'] }));

    const titles = (body: Array<{ title: string }>) => body.map((r) => r.title).sort();
    expect(titles((await request(app).get('/resources').expect(200)).body)).toEqual(['Public']);
    expect(titles((await request(app).get('/resources').set(auth('user_student')).expect(200)).body)).toEqual([
      'Private',
      'Public',
      'Students',
    ]);
    expect(titles((await request(app).get('/resources').set(auth('user_other')).expect(200)).body)).toEqual([
      'Public',
      'Students',
    ]);
    const admin = (await request(app).get('/resources').set(auth('user_admin')).expect(200)).body;
    expect(admin).toHaveLength(3);
    expect(admin.find((r: { id: string }) => r.id === priv.id).studentIds).toEqual(['user_student']);

    // Students never see who else a resource is shared with.
    const mine = (await request(app).get('/resources').set(auth('user_student')).expect(200)).body;
    expect(mine.find((r: { id: string }) => r.id === priv.id).studentIds).toEqual([]);

    // Download follows the same rules; hidden looks like missing.
    await request(app).get(`/resources/${pub.id}/download`).expect(200, { url: 'https://example.com/kinematics' });
    await request(app).get(`/resources/${students.id}/download`).expect(404);
    await request(app).get(`/resources/${priv.id}/download`).set(auth('user_other')).expect(404);
    await request(app).get(`/resources/${priv.id}/download`).set(auth('user_student')).expect(200);
  });

  it('share list is cleared unless private, and only new recipients are emailed', async () => {
    state.profiles.set('user_student', {
      id: 'user_student',
      email: 'student@test.dev',
      fullName: 'Sam Student',
      phone: null,
      role: 'student',
      createdAt: new Date().toISOString(),
    });
    const notPrivate = await create(link({ visibility: 'students', studentIds: ['user_student'] }));
    expect(state.resources.find((r) => r.id === notPrivate.id)!.studentIds).toEqual([]);
    expect(sendMail).not.toHaveBeenCalled();

    const shared = await create(link({ title: 'Mock exam <b>', visibility: 'private', studentIds: ['user_student'] }));
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0]![0] as { to: string; html: string; subject: string };
    expect(mail.to).toBe('student@test.dev');
    expect(mail.html).toContain('Mock exam &lt;b&gt;');
    expect(mail.html).toContain('https://tutorpro.test/dashboard#resources');

    // Re-saving with the same list does not email again.
    await request(app).patch(`/resources/${shared.id}`).set(auth('user_admin')).send({ title: 'Mock exam 2' }).expect(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('uploads a file, serves it through a signed URL, and removes it on replace/delete', async () => {
    await request(app).post('/resources/files?name=a.pdf').set(auth('user_student')).send('x').expect(403);
    await request(app)
      .post('/resources/files?name=a.pdf')
      .set(auth('user_admin'))
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(0))
      .expect(400);

    // A JSON file must arrive as raw bytes, not be parsed by express.json().
    const upload = await request(app)
      .post('/resources/files?name=' + encodeURIComponent('../My Notes (v2).json'))
      .set(auth('user_admin'))
      .set('Content-Type', 'application/json')
      .send('{"not":"parsed"}')
      .expect(201);
    expect(upload.body).toMatchObject({ fileName: 'My-Notes-v2.json', mimeType: 'application/json', sizeBytes: 16 });
    expect(upload.body.storagePath).toMatch(/^[0-9a-f-]{36}\/My-Notes-v2\.json$/);
    expect(state.files.get(upload.body.storagePath)!.body.toString()).toBe('{"not":"parsed"}');

    const created = await create({ title: 'Notes', kind: 'file', ...upload.body });
    expect(created).toMatchObject({ kind: 'file', url: null, fileName: 'My-Notes-v2.json', sizeBytes: 16 });

    // The same object can't back two resources.
    await request(app)
      .post('/resources')
      .set(auth('user_admin'))
      .send({ title: 'Dup', kind: 'file', ...upload.body })
      .expect(409);

    const dl = await request(app).get(`/resources/${created.id}/download`).set(auth('user_student')).expect(200);
    expect(dl.body.url).toContain(upload.body.storagePath);
    expect(dl.headers['cache-control']).toBe('no-store');

    // Switching to a link detaches and removes the file.
    await request(app)
      .patch(`/resources/${created.id}`)
      .set(auth('user_admin'))
      .send({ kind: 'video', url: 'https://youtu.be/abc' })
      .expect(200);
    expect(state.files.size).toBe(0);
    expect(state.resources[0]).toMatchObject({ kind: 'video', storagePath: null, fileName: null });

    const second = await request(app)
      .post('/resources/files?name=b.pdf')
      .set(auth('user_admin'))
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF'))
      .expect(201);
    const fileRes = await create({ title: 'B', kind: 'file', ...second.body });
    await request(app).delete(`/resources/${fileRes.id}`).set(auth('user_admin')).expect(204);
    expect(fakeDb.removeResourceFile).toHaveBeenLastCalledWith(second.body.storagePath);
  });

  it('safeFileName strips paths and odd characters', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\x\\Résumé final.pdf')).toBe('Resume-final.pdf');
    expect(safeFileName('...')).toBe('file');
    expect(safeFileName('')).toBe('file');
  });
});

describe('about (tutor profile)', () => {
  it('GET /content fills defaults; PUT validates and replaces it', async () => {
    const initial = (await request(app).get('/content').expect(200)).body;
    expect(initial.about.headline).toBeTruthy();
    expect(initial.about.stats).toEqual([]);

    const about = {
      ...initial.about,
      tutorName: 'Ramtin',
      email: 'ram@tutor.test',
      stats: [{ id: 's1', value: '10', label: 'Years' }],
      highlights: ['  IB examiner  ', ''],
    };
    await request(app).put('/content').set(auth('user_student')).send({ about }).expect(403);
    await request(app).put('/content').set(auth('user_admin')).send({ about: { ...about, photoUrl: 'javascript:x' } }).expect(400);
    await request(app).put('/content').set(auth('user_admin')).send({ about: { ...about, email: 'nope' } }).expect(400);

    const saved = (await request(app).put('/content').set(auth('user_admin')).send({ about }).expect(200)).body;
    expect(saved.about).toMatchObject({ tutorName: 'Ramtin', email: 'ram@tutor.test', highlights: ['IB examiner'] });

    // Other keys don't wipe it.
    await request(app).put('/content').set(auth('user_admin')).send({ faq: [] }).expect(200);
    expect((await request(app).get('/content').expect(200)).body.about.tutorName).toBe('Ramtin');
  });
});

describe('assessment questions', () => {
  it('defaults to the built-in test; admins replace it with validated questions', async () => {
    const initial = (await request(app).get('/content').expect(200)).body;
    expect(initial.assessmentQuestions).toHaveLength(5);

    const q = { id: 'n1', text: 'What is 2 + 2?', options: ['3', '4'], correctIndex: 1, topic: 'Arithmetic' };
    await request(app).put('/content').set(auth('user_admin')).send({ assessmentQuestions: [{ ...q, correctIndex: 2 }] }).expect(400);
    await request(app).put('/content').set(auth('user_admin')).send({ assessmentQuestions: [{ ...q, options: ['only'] }] }).expect(400);
    const saved = (await request(app).put('/content').set(auth('user_admin')).send({ assessmentQuestions: [q] }).expect(200)).body;
    expect(saved.assessmentQuestions).toEqual([q]);
    expect((await request(app).get('/content').expect(200)).body.assessmentQuestions).toEqual([q]);
  });
});

describe('policy sections', () => {
  it('defaults, then admins replace them', async () => {
    expect((await request(app).get('/content').expect(200)).body.policySections.length).toBeGreaterThan(0);
    const sections = [{ id: 'p1', title: 'Payments', body: 'Paid in advance.' }];
    await request(app).put('/content').set(auth('user_student')).send({ policySections: sections }).expect(403);
    const saved = (await request(app).put('/content').set(auth('user_admin')).send({ policySections: sections }).expect(200)).body;
    expect(saved.policySections).toEqual(sections);
  });
});

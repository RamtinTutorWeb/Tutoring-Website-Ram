import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { auth, clerkUsers, state } from './fakes.js';

const app = createApp();

function addStudent(id: string) {
  clerkUsers.set(id, { id, email: `${id}@test.dev`, fullName: `Name ${id}`, phone: null, role: 'student' });
}

describe('reviews', () => {
  it('student reviews are pending and hidden from the public; admin reviews are approved', async () => {
    await request(app).post('/reviews').send({ rating: 5, text: 'Great' }).expect(401);
    await request(app).post('/reviews').set(auth('user_student')).send({ rating: 9, text: 'x' }).expect(400);
    await request(app).post('/reviews').set(auth('user_student')).send({ rating: 4.5, text: 'x' }).expect(400);

    const pending = await request(app).post('/reviews').set(auth('user_student')).send({ rating: 5, text: 'Great' }).expect(201);
    expect(pending.body).toMatchObject({ name: 'Sam Student', rating: 5, text: 'Great', status: 'pending' });
    expect(state.reviews[0]?.studentId).toBe('user_student');

    const approved = await request(app)
      .post('/reviews')
      .set(auth('user_admin'))
      .send({ rating: 4, text: 'Tutor note', name: 'L.M.' })
      .expect(201);
    expect(approved.body).toMatchObject({ name: 'L.M.', status: 'approved' });

    const pub = await request(app).get('/content').expect(200);
    expect(pub.body.reviews.map((r: { id: string }) => r.id)).toEqual([approved.body.id]);
    const student = await request(app).get('/content').set(auth('user_student')).expect(200);
    expect(student.body.reviews).toHaveLength(1);
    const admin = await request(app).get('/content').set(auth('user_admin')).expect(200);
    expect(admin.body.reviews).toHaveLength(2);
  });

  it('PATCH /reviews/:id (admin) approves and edits; students get 403; unknown id 404', async () => {
    const created = await request(app).post('/reviews').set(auth('user_student')).send({ rating: 3, text: 'ok' }).expect(201);
    const id = created.body.id as string;

    await request(app).patch(`/reviews/${id}`).set(auth('user_student')).send({ status: 'approved' }).expect(403);
    await request(app).patch(`/reviews/${id}`).set(auth('user_admin')).send({ status: 'published' }).expect(400);
    await request(app).patch(`/reviews/${id}`).set(auth('user_admin')).send({ rating: 0 }).expect(400);
    await request(app).patch('/reviews/review_missing').set(auth('user_admin')).send({ status: 'approved' }).expect(404);

    const res = await request(app)
      .patch(`/reviews/${id}`)
      .set(auth('user_admin'))
      .send({ status: 'approved', name: 'S.S.', rating: 4, text: 'Good' })
      .expect(200);
    expect(res.body).toEqual({ id, name: 'S.S.', rating: 4, text: 'Good', status: 'approved' });
    const pub = await request(app).get('/content').expect(200);
    expect(pub.body.reviews).toEqual([res.body]);
  });

  it('DELETE /reviews/:id (admin) -> 204, then 404; students get 403', async () => {
    const created = await request(app).post('/reviews').set(auth('user_student')).send({ rating: 3, text: 'ok' }).expect(201);
    await request(app).delete(`/reviews/${created.body.id}`).set(auth('user_student')).expect(403);
    await request(app).delete(`/reviews/${created.body.id}`).set(auth('user_admin')).expect(204);
    expect(state.reviews).toHaveLength(0);
    await request(app).delete(`/reviews/${created.body.id}`).set(auth('user_admin')).expect(404);
  });

  it('429 once a student has 3 pending reviews', async () => {
    addStudent('user_pending');
    for (let i = 0; i < 3; i++) {
      await request(app).post('/reviews').set(auth('user_pending')).send({ rating: 5, text: `r${i}` }).expect(201);
    }
    const res = await request(app).post('/reviews').set(auth('user_pending')).send({ rating: 5, text: 'r4' }).expect(429);
    expect(res.body.error).toMatch(/waiting for approval/);

    // Approving one frees a slot.
    await request(app).patch(`/reviews/${state.reviews[0]!.id}`).set(auth('user_admin')).send({ status: 'approved' }).expect(200);
    await request(app).post('/reviews').set(auth('user_pending')).send({ rating: 5, text: 'r5' }).expect(201);
  });

  it('rate-limits submissions per user (5/hour), not globally', async () => {
    clerkUsers.set('user_admin_rl', { id: 'user_admin_rl', email: 'rl@test.dev', fullName: null, phone: null, role: 'admin' });
    for (let i = 0; i < 5; i++) {
      await request(app).post('/reviews').set(auth('user_admin_rl')).send({ rating: 5, text: `r${i}` }).expect(201);
    }
    const res = await request(app).post('/reviews').set(auth('user_admin_rl')).send({ rating: 5, text: 'r6' }).expect(429);
    expect(res.body).toEqual({ error: 'Too many reviews, please try again later' });

    addStudent('user_other_rl');
    await request(app).post('/reviews').set(auth('user_other_rl')).send({ rating: 5, text: 'fine' }).expect(201);
  });

  it('PUT /content rejects reviews with 400 and returns table reviews', async () => {
    const res = await request(app)
      .put('/content')
      .set(auth('user_admin'))
      .send({ reviews: [{ id: 'r1', name: 'x', rating: 5, text: 'y' }] })
      .expect(400);
    expect(res.body.error).toMatch(/\/reviews/);

    await request(app).post('/reviews').set(auth('user_student')).send({ rating: 5, text: 'Great' }).expect(201);
    const ok = await request(app).put('/content').set(auth('user_admin')).send({ faq: [] }).expect(200);
    expect(ok.body.reviews).toHaveLength(1);
    expect(state.settings.get('content')).not.toHaveProperty('reviews');
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { auth, clerkUsers, fakeDb, sendMail, state } from './fakes.js';

const app = createApp();

const guestRequest = {
  name: 'Jo <script>alert(1)</script>',
  email: 'Jo@Example.com',
  phone: '+1 555 0101',
  contactMethod: 'Email',
  serviceType: 'University',
  subject: 'Math',
  urgencyWindow: 'Within 2 weeks',
  isUrgent: true,
  hardTopics: 'Series & sequences',
  preferredSlot: 'Evenings',
  earliestDate: '2026-10-01',
  message: 'Midterm soon',
  consultation: true,
};

describe('POST /requests', () => {
  it('creates a guest request and emails ADMIN_EMAIL with every field, escaped', async () => {
    const res = await request(app).post('/requests').send(guestRequest).expect(201);
    expect(res.body).toMatchObject({
      ...guestRequest,
      email: 'jo@example.com',
      studentId: null,
      status: 'new',
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0]![0] as { to: string; html: string; text: string; replyTo: string };
    expect(mail.to).toBe('tutor@tutorpro.test');
    expect(mail.replyTo).toBe('jo@example.com');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('Jo &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mail.html).toContain('Series &amp; sequences');
    for (const value of ['+1 555 0101', 'University', 'Within 2 weeks', 'Evenings', '2026-10-01', 'Midterm soon']) {
      expect(mail.text).toContain(value);
    }
  });

  it('fills optional fields with empty strings', async () => {
    const res = await request(app).post('/requests').send({ name: 'Min', email: 'min@x.dev' }).expect(201);
    expect(res.body).toMatchObject({ phone: '', subject: '', earliestDate: '', isUrgent: false, consultation: false });
  });

  it('attaches studentId and ensures a profile when signed in', async () => {
    const res = await request(app)
      .post('/requests')
      .set(auth('user_student'))
      .send({ name: 'Sam', email: 'student@test.dev' })
      .expect(201);
    expect(res.body.studentId).toBe('user_student');
    expect(state.profiles.has('user_student')).toBe(true);
  });

  it.each([
    [{ email: 'a@b.dev' }, /^name/],
    [{ name: 'A', email: 'not-an-email' }, /^email/],
    [{ name: 'A', email: 'a@b.dev', earliestDate: '01/10/2026' }, /^earliestDate/],
    [{ name: 'A', email: 'a@b.dev', isUrgent: 'Yes' }, /^isUrgent/],
  ])('rejects invalid input %j', async (body, message) => {
    const res = await request(app).post('/requests').send(body).expect(400);
    expect(res.body.error).toMatch(message);
    expect(fakeDb.createRequest).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app).post('/requests').set('Content-Type', 'application/json').send('{"name":').expect(400);
    expect(res.body).toEqual({ error: 'Malformed JSON body' });
  });
});

describe('PATCH /requests/:id', () => {
  async function createOne() {
    const res = await request(app).post('/requests').send(guestRequest).expect(201);
    sendMail.mockClear();
    return res.body.id as string;
  }

  it('emails the requester a /book link when accepted, once', async () => {
    const id = await createOne();
    const res = await request(app).patch(`/requests/${id}`).set(auth('user_admin')).send({ status: 'accepted' }).expect(200);
    expect(res.body.status).toBe('accepted');

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0]![0] as { to: string; html: string; text: string };
    expect(mail.to).toBe('jo@example.com');
    expect(mail.text).toContain(`https://tutorpro.test/book?request=${id}`);
    expect(mail.html).toContain(`https://tutorpro.test/book?request=${id}`);

    await request(app).patch(`/requests/${id}`).set(auth('user_admin')).send({ status: 'accepted' }).expect(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('does not email on other status changes', async () => {
    const id = await createOne();
    await request(app).patch(`/requests/${id}`).set(auth('user_admin')).send({ status: 'declined' }).expect(200);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('validates status and id', async () => {
    const id = await createOne();
    await request(app).patch(`/requests/${id}`).set(auth('user_admin')).send({ status: 'open' }).expect(400);
    await request(app)
      .patch('/requests/00000000-0000-4000-8000-000000000099')
      .set(auth('user_admin'))
      .send({ status: 'accepted' })
      .expect(404);
    await request(app).patch('/requests/not-a-uuid').set(auth('user_admin')).send({ status: 'accepted' }).expect(404);
  });

  it('still succeeds when Resend errors', async () => {
    const id = await createOne();
    sendMail.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as never);
    await request(app).patch(`/requests/${id}`).set(auth('user_admin')).send({ status: 'accepted' }).expect(200);
  });
});

describe('content, learner courses, assessments', () => {
  it('PUT /content merges, normalizes and splits the catalog', async () => {
    const res = await request(app)
      .put('/content')
      .set(auth('user_admin'))
      .send({
        courses: [
          { id: 'c1', title: 'Calc', category: 'University Courses', description: 'd' },
          { id: 'c2', title: 'SAT', category: 'Exam Prep', description: 'd' },
        ],
        selectableOptions: { contactMethods: ['  Email ', 'Email', 'Text   message', ''] },
      })
      .expect(200);
    expect(res.body.courses.map((c: { id: string }) => c.id)).toEqual(['c1']);
    expect(res.body.examPrepTracks.map((c: { id: string }) => c.id)).toEqual(['c2']);
    expect(res.body.selectableOptions.contactMethods).toEqual(['Email', 'Text message']);
    expect(res.body.selectableOptions.serviceTypes).toEqual(['High School', 'University', 'Exam Prep']);

    const again = await request(app).get('/content').expect(200);
    expect(again.body).toEqual(res.body);
  });

  it('registers a course once (409 on repeat), admin can change status', async () => {
    await request(app)
      .put('/content')
      .set(auth('user_admin'))
      .send({ courses: [{ id: 'c1', title: 'Calc', category: 'University Courses', description: '' }] })
      .expect(200);
    await request(app).post('/learner-courses').set(auth('user_student')).send({ courseId: 'nope' }).expect(400);
    const created = await request(app).post('/learner-courses').set(auth('user_student')).send({ courseId: 'c1' }).expect(201);
    expect(created.body).toMatchObject({ studentId: 'user_student', courseId: 'c1', status: 'registered' });
    await request(app).post('/learner-courses').set(auth('user_student')).send({ courseId: 'c1' }).expect(409);

    const patched = await request(app)
      .patch(`/learner-courses/${created.body.id}`)
      .set(auth('user_admin'))
      .send({ status: 'passed' })
      .expect(200);
    expect(patched.body.status).toBe('passed');
  });

  it('stores assessments with total and recommendation', async () => {
    const res = await request(app)
      .post('/assessments')
      .set(auth('user_student'))
      .send({ subject: 'Math', answers: { q1: 'a' }, score: 7, total: 10, recommendation: 'Calculus I' })
      .expect(201);
    expect(res.body).toMatchObject({ studentId: 'user_student', score: 7, total: 10, recommendation: 'Calculus I' });
    const list = await request(app).get('/assessments').set(auth('user_student')).expect(200);
    expect(list.body).toHaveLength(1);
  });
});

describe('reviews and learner-course extensions used by the frontend', () => {
  it('POST /reviews stores a pending review hidden from the public until approved', async () => {
    await request(app).post('/reviews').send({ rating: 5, text: 'Great' }).expect(401);
    await request(app).post('/reviews').set(auth('user_student')).send({ rating: 9, text: 'x' }).expect(400);
    const created = await request(app).post('/reviews').set(auth('user_student')).send({ rating: 5, text: 'Great' }).expect(201);
    expect(created.body).toMatchObject({ name: 'Sam Student', rating: 5, text: 'Great', status: 'pending' });

    const pub = await request(app).get('/content').expect(200);
    expect(pub.body.reviews).toEqual([]);
    const student = await request(app).get('/content').set(auth('user_student')).expect(200);
    expect(student.body.reviews).toEqual([]);
    const admin = await request(app).get('/content').set(auth('user_admin')).expect(200);
    expect(admin.body.reviews).toHaveLength(1);

    await request(app)
      .put('/content')
      .set(auth('user_admin'))
      .send({ reviews: [{ ...created.body, status: 'approved' }] })
      .expect(200);
    const after = await request(app).get('/content').expect(200);
    expect(after.body.reviews).toHaveLength(1);
  });

  it('admins can assign a course to a student; students cannot assign to others', async () => {
    await request(app)
      .put('/content')
      .set(auth('user_admin'))
      .send({ courses: [{ id: 'c1', title: 'Calc', category: 'University Courses', description: '' }] })
      .expect(200);
    await request(app).get('/me').set(auth('user_student')).expect(200);

    const assigned = await request(app)
      .post('/learner-courses')
      .set(auth('user_admin'))
      .send({ courseId: 'c1', studentId: 'user_student' })
      .expect(201);
    expect(assigned.body.studentId).toBe('user_student');
    await request(app)
      .post('/learner-courses')
      .set(auth('user_admin'))
      .send({ courseId: 'c1', studentId: 'user_ghost' })
      .expect(404);

    // A student's studentId is ignored: the record is always their own.
    clerkUsers.set('user_other', { id: 'user_other', email: 'o@test.dev', fullName: null, phone: null, role: 'student' });
    const own = await request(app)
      .post('/learner-courses')
      .set(auth('user_other'))
      .send({ courseId: 'c1', studentId: 'user_student' })
      .expect(201);
    expect(own.body.studentId).toBe('user_other');
  });

  it('DELETE /learner-courses/:id: own record or admin, else 404', async () => {
    await request(app)
      .put('/content')
      .set(auth('user_admin'))
      .send({ courses: [{ id: 'c1', title: 'Calc', category: 'University Courses', description: '' }] })
      .expect(200);
    const mine = await request(app).post('/learner-courses').set(auth('user_student')).send({ courseId: 'c1' }).expect(201);
    clerkUsers.set('user_other', { id: 'user_other', email: 'o@test.dev', fullName: null, phone: null, role: 'student' });

    await request(app).delete(`/learner-courses/${mine.body.id}`).expect(401);
    await request(app).delete(`/learner-courses/${mine.body.id}`).set(auth('user_other')).expect(404);
    await request(app).delete(`/learner-courses/${mine.body.id}`).set(auth('user_student')).expect(204);
    expect(state.learnerCourses).toHaveLength(0);

    const again = await request(app).post('/learner-courses').set(auth('user_student')).send({ courseId: 'c1' }).expect(201);
    await request(app).delete(`/learner-courses/${again.body.id}`).set(auth('user_admin')).expect(204);
  });
});

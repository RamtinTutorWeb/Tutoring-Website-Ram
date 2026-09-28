import request from 'supertest';
import { Webhook } from 'svix';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { signCalendlyPayload } from '../src/lib/calendly.js';
import { auth, fakeDb, state } from './fakes.js';

const app = createApp();

// --- Clerk ---------------------------------------------------------------------------

function clerkDelivery(payload: object, msgId = `msg_${Math.random().toString(36).slice(2)}`) {
  const body = JSON.stringify(payload);
  const timestamp = new Date();
  const signature = new Webhook(process.env['CLERK_WEBHOOK_SIGNING_SECRET']!).sign(msgId, timestamp, body);
  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'svix-id': msgId,
      'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'svix-signature': signature,
    },
  };
}

const clerkUser = (overrides: Record<string, unknown> = {}) => ({
  type: 'user.created',
  data: {
    id: 'user_new',
    first_name: 'New',
    last_name: 'Person',
    email_addresses: [{ id: 'idn_1', email_address: 'New.Person@Example.com' }],
    primary_email_address_id: 'idn_1',
    phone_numbers: [],
    public_metadata: { role: 'admin' },
    ...overrides,
  },
});

describe('POST /webhooks/clerk', () => {
  it('verifies the Svix signature and upserts the profile', async () => {
    const d = clerkDelivery(clerkUser());
    const res = await request(app).post('/webhooks/clerk').set(d.headers).send(d.body).expect(200);
    expect(res.body).toEqual({ ok: true, type: 'user.created' });
    expect(state.profiles.get('user_new')).toMatchObject({
      email: 'new.person@example.com',
      fullName: 'New Person',
      role: 'admin',
    });
  });

  it('mirrors a demotion from Clerk metadata', async () => {
    const created = clerkDelivery(clerkUser());
    await request(app).post('/webhooks/clerk').set(created.headers).send(created.body).expect(200);
    const d = clerkDelivery({ ...clerkUser({ public_metadata: {} }), type: 'user.updated' });
    await request(app).post('/webhooks/clerk').set(d.headers).send(d.body).expect(200);
    expect(state.profiles.get('user_new')?.role).toBe('student');
  });

  it('user.updated keeps a name/phone edited via PATCH /me but mirrors email and role', async () => {
    const created = clerkDelivery(clerkUser());
    await request(app).post('/webhooks/clerk').set(created.headers).send(created.body).expect(200);
    state.profiles.set('user_new', { ...state.profiles.get('user_new')!, fullName: 'Edited Name', phone: '+1 555 0199' });

    const updated = clerkDelivery({
      ...clerkUser({
        first_name: 'Clerk',
        last_name: 'Name',
        email_addresses: [{ id: 'idn_2', email_address: 'changed@example.com' }],
        primary_email_address_id: 'idn_2',
        phone_numbers: [{ id: 'ph_1', phone_number: '+1 555 0000' }],
        public_metadata: {},
      }),
      type: 'user.updated',
    });
    await request(app).post('/webhooks/clerk').set(updated.headers).send(updated.body).expect(200);
    expect(state.profiles.get('user_new')).toMatchObject({
      fullName: 'Edited Name',
      phone: '+1 555 0199',
      email: 'changed@example.com',
      role: 'student',
    });
  });

  it('rejects a bad signature and missing headers', async () => {
    const d = clerkDelivery(clerkUser());
    const bad = await request(app)
      .post('/webhooks/clerk')
      .set({ ...d.headers, 'svix-signature': 'v1,AAAA' })
      .send(d.body)
      .expect(400);
    expect(bad.body).toEqual({ error: 'Invalid signature' });
    const tampered = await request(app)
      .post('/webhooks/clerk')
      .set(d.headers)
      .send(d.body.replace('admin', 'superuser'))
      .expect(400);
    expect(tampered.body).toEqual({ error: 'Invalid signature' });
    await request(app).post('/webhooks/clerk').set('Content-Type', 'application/json').send(d.body).expect(400);
    expect(fakeDb.syncProfileFromClerk).not.toHaveBeenCalled();
  });

  it('is idempotent on svix-id', async () => {
    const d = clerkDelivery(clerkUser(), 'msg_fixed');
    await request(app).post('/webhooks/clerk').set(d.headers).send(d.body).expect(200);
    const again = await request(app).post('/webhooks/clerk').set(d.headers).send(d.body).expect(200);
    expect(again.body).toEqual({ ok: true, duplicate: true });
    expect(fakeDb.syncProfileFromClerk).toHaveBeenCalledTimes(1);
  });

  it('deletes the profile on user.deleted', async () => {
    const created = clerkDelivery(clerkUser());
    await request(app).post('/webhooks/clerk').set(created.headers).send(created.body).expect(200);
    const d = clerkDelivery({ type: 'user.deleted', data: { id: 'user_new', deleted: true } });
    await request(app).post('/webhooks/clerk').set(d.headers).send(d.body).expect(200);
    expect(state.profiles.has('user_new')).toBe(false);
  });

  it('un-records the event when processing fails so the retry runs', async () => {
    vi.mocked(fakeDb.syncProfileFromClerk).mockRejectedValueOnce(new Error('db down'));
    const d = clerkDelivery(clerkUser(), 'msg_retry');
    await request(app).post('/webhooks/clerk').set(d.headers).send(d.body).expect(500);
    await request(app).post('/webhooks/clerk').set(d.headers).send(d.body).expect(200);
    expect(state.profiles.has('user_new')).toBe(true);
  });
});

// --- Calendly --------------------------------------------------------------------------

const SIGNING_KEY = 'calendly-test-signing-key';

function calendlyDelivery(payload: object, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(payload);
  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'Calendly-Webhook-Signature': signCalendlyPayload(body, SIGNING_KEY, timestamp),
    },
  };
}

const invitee = (
  event: 'invitee.created' | 'invitee.canceled',
  requestId: string,
  createdAt = '2026-10-01T10:00:00Z',
  extra: Record<string, unknown> = {},
) => ({
  event,
  created_at: createdAt,
  payload: {
    uri: 'https://api.calendly.com/scheduled_events/EV1/invitees/INV1',
    ...extra,
    event: 'https://api.calendly.com/scheduled_events/EV1',
    email: 'Jo@Example.com',
    name: 'Jo',
    tracking: { utm_content: requestId },
    cancellation: event === 'invitee.canceled' ? { reason: 'Sick' } : null,
    scheduled_event: {
      name: 'Tutoring session',
      start_time: '2026-10-05T15:00:00Z',
      end_time: '2026-10-05T16:00:00Z',
    },
  },
});

async function acceptedRequest(): Promise<string> {
  const res = await request(app).post('/requests').send({ name: 'Jo', email: 'jo@example.com' }).expect(201);
  state.requests[0]!.status = 'accepted';
  return res.body.id as string;
}

describe('POST /webhooks/calendly', () => {
  it('verifies the HMAC, upserts the booking and marks the request scheduled', async () => {
    const requestId = await acceptedRequest();
    const d = calendlyDelivery(invitee('invitee.created', requestId));
    const res = await request(app).post('/webhooks/calendly').set(d.headers).send(d.body).expect(200);
    expect(res.body).toEqual({ ok: true, type: 'invitee.created' });

    const booking = [...state.bookings.values()][0];
    expect(booking).toMatchObject({
      requestId,
      inviteeEmail: 'jo@example.com',
      eventTypeName: 'Tutoring session',
      startAt: '2026-10-05T15:00:00Z',
      status: 'scheduled',
    });
    expect(state.requests[0]!.status).toBe('scheduled');
  });

  it('is idempotent: a redelivery does not write twice', async () => {
    const requestId = await acceptedRequest();
    const d = calendlyDelivery(invitee('invitee.created', requestId));
    await request(app).post('/webhooks/calendly').set(d.headers).send(d.body).expect(200);
    const again = await request(app).post('/webhooks/calendly').set(d.headers).send(d.body).expect(200);
    expect(again.body).toEqual({ ok: true, duplicate: true });
    expect(fakeDb.upsertBooking).toHaveBeenCalledTimes(1);
  });

  it('cancels the same booking row and reopens the request', async () => {
    const requestId = await acceptedRequest();
    const c = calendlyDelivery(invitee('invitee.created', requestId));
    await request(app).post('/webhooks/calendly').set(c.headers).send(c.body).expect(200);
    const x = calendlyDelivery(invitee('invitee.canceled', requestId, '2026-10-02T10:00:00Z'));
    await request(app).post('/webhooks/calendly').set(x.headers).send(x.body).expect(200);

    expect(state.bookings.size).toBe(1);
    expect([...state.bookings.values()][0]).toMatchObject({ status: 'canceled', cancelReason: 'Sick' });
    expect(state.requests[0]!.status).toBe('accepted');
  });

  it('a reschedule does not reopen the request, and the new booking inherits the request link', async () => {
    const requestId = await acceptedRequest();
    const created = calendlyDelivery(invitee('invitee.created', requestId));
    await request(app).post('/webhooks/calendly').set(created.headers).send(created.body).expect(200);

    const NEW_URI = 'https://api.calendly.com/scheduled_events/EV2/invitees/INV2';
    const canceled = calendlyDelivery(
      invitee('invitee.canceled', requestId, '2026-10-02T10:00:00Z', { rescheduled: true, new_invitee: NEW_URI }),
    );
    await request(app).post('/webhooks/calendly').set(canceled.headers).send(canceled.body).expect(200);
    expect(state.requests[0]!.status).toBe('scheduled');

    // Calendly's new invitee may come without tracking: linked through old_invitee.
    const rebooked = calendlyDelivery(
      invitee('invitee.created', requestId, '2026-10-02T10:00:01Z', {
        uri: NEW_URI,
        event: 'https://api.calendly.com/scheduled_events/EV2',
        tracking: null,
        old_invitee: 'https://api.calendly.com/scheduled_events/EV1/invitees/INV1',
      }),
    );
    await request(app).post('/webhooks/calendly').set(rebooked.headers).send(rebooked.body).expect(200);
    expect(state.bookings.get(NEW_URI)).toMatchObject({ requestId, status: 'scheduled' });
    expect(state.requests[0]!.status).toBe('scheduled');

    // Canceling the rebooked invitee (still no tracking) finds the request via its own booking row.
    const x = calendlyDelivery(
      invitee('invitee.canceled', requestId, '2026-10-03T10:00:00Z', {
        uri: NEW_URI,
        event: 'https://api.calendly.com/scheduled_events/EV2',
        tracking: null,
      }),
    );
    await request(app).post('/webhooks/calendly').set(x.headers).send(x.body).expect(200);
    expect(state.bookings.get(NEW_URI)?.status).toBe('canceled');
    expect(state.requests[0]!.status).toBe('accepted');
  });

  it('keeps the request scheduled while another booking for it is still scheduled', async () => {
    const requestId = await acceptedRequest();
    const second = { uri: 'https://api.calendly.com/scheduled_events/EV1/invitees/INV9' };
    for (const extra of [{}, second]) {
      const d = calendlyDelivery(invitee('invitee.created', requestId, '2026-10-01T10:00:00Z', extra));
      await request(app).post('/webhooks/calendly').set(d.headers).send(d.body).expect(200);
    }
    expect(state.bookings.size).toBe(2); // same event URI, two invitees (group event)

    const x = calendlyDelivery(invitee('invitee.canceled', requestId, '2026-10-02T10:00:00Z'));
    await request(app).post('/webhooks/calendly').set(x.headers).send(x.body).expect(200);
    expect(state.requests[0]!.status).toBe('scheduled');

    const y = calendlyDelivery(invitee('invitee.canceled', requestId, '2026-10-02T11:00:00Z', second));
    await request(app).post('/webhooks/calendly').set(y.headers).send(y.body).expect(200);
    expect(state.requests[0]!.status).toBe('accepted');
  });

  it("links the booking to the request's student, not whoever owns the invitee email", async () => {
    // Profile with the invitee's email exists, but the request belongs to someone else.
    state.profiles.set('user_email_owner', {
      id: 'user_email_owner',
      email: 'jo@example.com',
      fullName: null,
      phone: null,
      role: 'student',
      createdAt: new Date().toISOString(),
    });
    const res = await request(app)
      .post('/requests')
      .set(auth('user_student'))
      .send({ name: 'Sam', email: 'student@test.dev' })
      .expect(201);
    const d = calendlyDelivery(invitee('invitee.created', res.body.id));
    await request(app).post('/webhooks/calendly').set(d.headers).send(d.body).expect(200);
    expect([...state.bookings.values()][0]?.studentId).toBe('user_student');

    // Guest request: no student, and the email match is NOT used.
    state.bookings.clear();
    const guest = await acceptedRequest();
    const g = calendlyDelivery(invitee('invitee.created', guest, '2026-10-03T10:00:00Z'));
    await request(app).post('/webhooks/calendly').set(g.headers).send(g.body).expect(200);
    expect([...state.bookings.values()][0]?.studentId).toBeNull();
  });

  it('falls back to the invitee email when there is no request', async () => {
    state.profiles.set('user_email_owner', {
      id: 'user_email_owner',
      email: 'jo@example.com',
      fullName: null,
      phone: null,
      role: 'student',
      createdAt: new Date().toISOString(),
    });
    const d = calendlyDelivery(invitee('invitee.created', ''));
    await request(app).post('/webhooks/calendly').set(d.headers).send(d.body).expect(200);
    expect([...state.bookings.values()][0]).toMatchObject({ studentId: 'user_email_owner', requestId: null });
  });

  it('ignores a utm_content that is not a known request', async () => {
    const d = calendlyDelivery(invitee('invitee.created', 'not-a-uuid'));
    await request(app).post('/webhooks/calendly').set(d.headers).send(d.body).expect(200);
    expect([...state.bookings.values()][0]?.requestId).toBeNull();
  });

  it('rejects bad, stale and missing signatures', async () => {
    const payload = invitee('invitee.created', '00000000-0000-4000-8000-000000000001');
    const d = calendlyDelivery(payload);
    await request(app)
      .post('/webhooks/calendly')
      .set({ ...d.headers, 'Calendly-Webhook-Signature': signCalendlyPayload(d.body, 'wrong-key', Math.floor(Date.now() / 1000)) })
      .send(d.body)
      .expect(400);
    const stale = calendlyDelivery(payload, Math.floor(Date.now() / 1000) - 600);
    await request(app).post('/webhooks/calendly').set(stale.headers).send(stale.body).expect(400);
    await request(app).post('/webhooks/calendly').set('Content-Type', 'application/json').send(d.body).expect(400);
    expect(fakeDb.recordWebhookEvent).not.toHaveBeenCalled();
  });
});

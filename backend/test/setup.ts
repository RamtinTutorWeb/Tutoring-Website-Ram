import { beforeEach, vi } from 'vitest';

// env.ts reads process.env once at import, so this must run before the app loads.
Object.assign(process.env, {
  NODE_ENV: 'test',
  FRONTEND_URL: 'https://tutorpro.test,https://www.tutorpro.test',
  CLERK_PUBLISHABLE_KEY: 'pk_test_x',
  CLERK_SECRET_KEY: 'sk_test_x',
  CLERK_WEBHOOK_SIGNING_SECRET: `whsec_${Buffer.from('clerk-webhook-test-secret-32byte').toString('base64')}`,
  SUPABASE_URL: 'http://supabase.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  RESEND_API_KEY: 're_test',
  MAIL_FROM: 'TutorPro <hello@tutorpro.test>',
  ADMIN_EMAIL: 'tutor@tutorpro.test',
  CALENDLY_WEBHOOK_SIGNING_KEY: 'calendly-test-signing-key',
  ADMIN_API_TOKEN: 'admin-token-test',
});

vi.mock('../src/db.js', async () => (await import('./fakes.js')).fakeDb);

vi.mock('../src/lib/clerk.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/clerk.js')>()),
  ...(await import('./fakes.js')).fakeClerk,
}));

vi.mock('resend', async () => {
  const { sendMail } = await import('./fakes.js');
  return {
    Resend: class {
      emails = { send: sendMail };
    },
  };
});

beforeEach(async () => {
  const { resetState } = await import('./fakes.js');
  vi.clearAllMocks();
  resetState();
});

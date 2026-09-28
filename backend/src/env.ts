/**
 * Typed view of process.env, read once at startup.
 *
 * Nothing here throws: a missing integration is reported by `configured()` and
 * the code that needs it fails (or skips) at call time. Never log the values.
 */

function opt(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function readEnv() {
  const nodeEnv = opt('NODE_ENV') ?? 'development';
  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number(opt('PORT') ?? 4000),
    /** Allowed CORS origins, in order. The first one is used for links in emails. */
    frontendOrigins: (opt('FRONTEND_URL') ?? '')
      .split(',')
      .map((origin) => stripSlash(origin.trim()))
      .filter(Boolean),
    clerk: {
      publishableKey: opt('CLERK_PUBLISHABLE_KEY'),
      secretKey: opt('CLERK_SECRET_KEY'),
      webhookSigningSecret: opt('CLERK_WEBHOOK_SIGNING_SECRET'),
    },
    supabase: {
      url: opt('SUPABASE_URL'),
      serviceRoleKey: opt('SUPABASE_SERVICE_ROLE_KEY'),
    },
    resend: {
      apiKey: opt('RESEND_API_KEY'),
      mailFrom: opt('MAIL_FROM'),
    },
    adminEmail: opt('ADMIN_EMAIL'),
    calendly: {
      personalAccessToken: opt('CALENDLY_PERSONAL_ACCESS_TOKEN'),
      webhookSigningKey: opt('CALENDLY_WEBHOOK_SIGNING_KEY'),
    },
    publicApiUrl: opt('PUBLIC_API_URL') ? stripSlash(opt('PUBLIC_API_URL')!) : undefined,
    adminApiToken: opt('ADMIN_API_TOKEN'),
  };
}

export const env = readEnv();

export interface Configured {
  clerk: boolean;
  supabase: boolean;
  resend: boolean;
  calendly: boolean;
}

/** Which integrations have their required variables set. Booleans only. */
export function configured(): Configured {
  return {
    clerk: Boolean(env.clerk.publishableKey && env.clerk.secretKey),
    supabase: Boolean(env.supabase.url && env.supabase.serviceRoleKey),
    resend: Boolean(env.resend.apiKey && env.resend.mailFrom),
    calendly: Boolean(env.calendly.webhookSigningKey),
  };
}

/** Origin the frontend is served from, for links in emails. */
export function frontendBaseUrl(): string {
  return env.frontendOrigins[0] ?? 'http://localhost:5173';
}

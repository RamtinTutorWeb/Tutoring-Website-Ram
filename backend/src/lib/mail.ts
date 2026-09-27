import { Resend } from 'resend';
import { configured, env, frontendBaseUrl } from '../env.js';
import type { SessionRequest } from '../types.js';

let client: Resend | undefined;

function getClient(): Resend {
  client ??= new Resend(env.resend.apiKey);
  return client;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/** Sends through Resend. Never throws: a mail failure must not fail the request. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!configured().resend) {
    console.warn(`mail skipped (Resend not configured): "${mail.subject}"`);
    return false;
  }
  try {
    const { error } = await getClient().emails.send({
      from: env.resend.mailFrom!,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    });
    if (error) {
      console.error(`mail failed: "${mail.subject}": ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`mail failed: "${mail.subject}":`, err instanceof Error ? err.message : err);
    return false;
  }
}

function layout(bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1f1f;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e0;border-radius:8px;padding:24px">
${bodyHtml}
</div></body></html>`;
}

function requestRows(request: SessionRequest): Array<[string, string]> {
  return [
    ['Name', request.name],
    ['Email', request.email],
    ['Phone', request.phone],
    ['Preferred contact', request.contactMethod],
    ['Service', request.serviceType],
    ['Subject', request.subject],
    ['Urgency', request.urgencyWindow],
    ['Urgent', request.isUrgent ? 'Yes' : 'No'],
    ['Hard topics', request.hardTopics],
    ['Preferred slot', request.preferredSlot],
    ['Earliest date', request.earliestDate],
    ['Free consultation', request.consultation ? 'Yes' : 'No'],
    ['Signed-in student', request.studentId ?? 'No (guest)'],
    ['Message', request.message],
    ['Request id', request.id],
  ];
}

/** New request -> tutor inbox (ADMIN_EMAIL), with every field. */
export async function sendNewRequestEmail(request: SessionRequest): Promise<boolean> {
  if (!env.adminEmail) {
    console.warn('mail skipped: ADMIN_EMAIL is not set');
    return false;
  }
  const rows = requestRows(request);
  const html = layout(`
<h2 style="margin:0 0 16px;font-size:20px">New tutoring request</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${rows
  .map(
    ([label, value]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>` +
      `<td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(value || '-')}</td></tr>`,
  )
  .join('\n')}
</table>
<p style="margin:16px 0 0;font-size:13px;color:#666">Reply to this email to contact the requester.</p>`);
  const text = ['New tutoring request', '', ...rows.map(([label, value]) => `${label}: ${value || '-'}`)].join('\n');

  return sendMail({
    to: env.adminEmail,
    subject: `New tutoring request from ${request.name}`,
    html,
    text,
    replyTo: request.email,
  });
}

/** Request accepted -> requester, with the link to book on Calendly. */
export async function sendRequestAcceptedEmail(request: SessionRequest): Promise<boolean> {
  const link = `${frontendBaseUrl()}/book?request=${encodeURIComponent(request.id)}`;
  const subjectLine = request.subject ? ` for ${request.subject}` : '';
  const html = layout(`
<h2 style="margin:0 0 16px;font-size:20px">Your tutoring request was accepted</h2>
<p>Hi ${escapeHtml(request.name)},</p>
<p>Good news: your request${escapeHtml(subjectLine)} has been accepted. Pick a time that suits you:</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#1f1f1f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Book your session</a></p>
<p style="font-size:13px;color:#666">Or open this link: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`);
  const text = [
    `Hi ${request.name},`,
    '',
    `Good news: your request${subjectLine} has been accepted. Book your session here:`,
    link,
  ].join('\n');

  return sendMail({
    to: request.email,
    subject: 'Your tutoring request was accepted',
    html,
    text,
    ...(env.adminEmail ? { replyTo: env.adminEmail } : {}),
  });
}

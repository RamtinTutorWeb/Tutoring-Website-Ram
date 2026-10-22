import { createHmac } from "node:crypto";
import { expect, type Browser, type Page } from "@playwright/test";
import { E2E } from "./playwright.config";

export const ADMIN = "user_dev_admin";
export const STUDENT = "user_dev_student";

/** A fresh browser context signed in through the dev sign-in screen. */
export async function signedIn(browser: Browser, userId: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in");
  const label = userId === ADMIN ? "Tutor (admin)" : userId === STUDENT ? "Student" : "New student";
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(page).toHaveURL(userId === ADMIN ? /\/admin/ : /\/dashboard/);
  await expect(page.locator(".dashboard-hero")).toBeVisible();
  return page;
}

/** Delivers a signed Calendly webhook straight to the API, like Calendly would. */
export async function calendlyWebhook(event: "invitee.created" | "invitee.canceled", payload: Record<string, unknown>) {
  const body = JSON.stringify({ event, created_at: new Date().toISOString(), payload });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", E2E.calendlyKey).update(`${t}.`).update(body).digest("hex");
  const res = await fetch(`${E2E.api}/webhooks/calendly`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Calendly-Webhook-Signature": `t=${t},v1=${v1}` },
    body
  });
  expect(res.status).toBe(200);
}

/** API call as a dev user (for setup/assertions that don't need the UI). */
export async function api<T>(userId: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${E2E.api}${path}`, {
    ...init,
    headers: { ...(userId ? { Authorization: `Bearer dev:${userId}` } : {}), ...(init.headers ?? {}) }
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;

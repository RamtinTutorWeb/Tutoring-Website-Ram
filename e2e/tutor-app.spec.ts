import { expect, test } from "@playwright/test";
import { ADMIN, api, calendlyWebhook, signedIn, STUDENT, unique } from "./helpers";

test.describe.configure({ mode: "serial" });

test("public site: home, courses, resources and assessment work signed out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#free-resources .resource-card")).not.toHaveCount(0);
  await expect(page.locator("#reviews-list .review-card")).not.toHaveCount(0);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Courses" }).click();
  await expect(page.locator(".course-card")).not.toHaveCount(0);

  await page.goto("/resources");
  // Only public resources for visitors: the students-only and private seeds stay hidden.
  await expect(page.getByText("Calculus formula sheet")).toBeVisible();
  await expect(page.getByText("Mechanics practice set")).toHaveCount(0);
  await expect(page.getByText("Your integration plan")).toHaveCount(0);

  await page.goto("/assessment");
  await page.locator('select[name="subject"]').selectOption("Math");
  for (const fieldset of await page.locator("#assessment-form fieldset").all()) {
    await fieldset.locator('input[type="radio"]').first().check();
  }
  await page.getByRole("button", { name: "See My Result" }).click();
  await expect(page.locator("#assessment-result")).toContainText("Score:");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "About" }).click();
  await expect(page.locator("[data-page=about] h2").first()).toBeVisible();
});

test("booking loop: request -> admin accepts -> Calendly booking -> cancel reopens", async ({ browser }) => {
  const subjectNote = unique("Need help with vectors");
  const student = await signedIn(browser, STUDENT);
  await student.goto("/contact");
  await student.locator('select[name="subject"]').selectOption("Physics");
  await student.locator('textarea[name="message"]').fill(subjectNote);
  await student.getByLabel("I'm not a robot").check();
  await student.getByRole("button", { name: "Send request" }).click();
  await expect(student.locator("#contact-success")).toBeVisible();

  const admin = await signedIn(browser, ADMIN);
  await admin.goto("/admin");
  // Message text is inside the collapsed <details>, which still matches.
  const row = admin.locator("details.request-detail", { hasText: subjectNote });
  await expect(row.locator("summary")).toContainText("Physics");
  await expect(row.locator("summary")).toContainText("From: Student User");
  await row.locator("summary").click();
  await row.getByRole("button", { name: "Accept" }).click();
  await expect(row.locator(".request-status")).toHaveText("Accepted");
  await expect(row.getByRole("button", { name: "Copy booking link" })).toBeVisible();

  // Student sees Book now with the request id.
  await student.goto("/dashboard");
  const requests = await api<Array<{ id: string; message: string; status: string }>>(STUDENT, "/requests");
  const request = requests.find((r) => r.message === subjectNote)!;
  expect(request.status).toBe("accepted");
  await expect(student.locator(".ready-to-book").locator(`a[href="/book?request=${request.id}"]`)).toBeVisible();

  // Calendly confirms the booking.
  const start = new Date(Date.now() + 3 * 86_400_000);
  start.setUTCHours(15, 0, 0, 0);
  const invitee = {
    uri: `https://api.calendly.com/scheduled_events/E2E/invitees/${request.id}`,
    event: "https://api.calendly.com/scheduled_events/E2E",
    email: "student@local.test",
    name: "Student User",
    tracking: { utm_content: request.id },
    scheduled_event: { name: "Physics session", start_time: start.toISOString(), end_time: new Date(start.getTime() + 3_600_000).toISOString() },
    cancel_url: "https://calendly.com/cancellations/E2E",
    reschedule_url: "https://calendly.com/reschedulings/E2E"
  };
  await calendlyWebhook("invitee.created", invitee);

  await student.reload();
  await expect(student.locator(".next-session:not(.ready-to-book)")).toContainText("Physics session");
  await expect(student.locator(".next-session:not(.ready-to-book)").getByRole("link", { name: "Reschedule" })).toHaveAttribute("href", invitee.reschedule_url);
  await expect(student.locator(".next-session:not(.ready-to-book)").getByRole("link", { name: "Cancel" })).toHaveAttribute("href", invitee.cancel_url);

  await admin.goto("/admin");
  await expect(admin.locator(".card", { has: admin.getByRole("heading", { name: "Booked sessions" }) })).toContainText("Physics session");
  expect((await api<Array<{ id: string; status: string }>>(ADMIN, "/requests")).find((r) => r.id === request.id)!.status).toBe("scheduled");

  // Cancel in Calendly: booking shows canceled and the request reopens for rebooking.
  await calendlyWebhook("invitee.canceled", { ...invitee, cancellation: { reason: "Clash with exam" } });
  await student.reload();
  await expect(student.locator(".next-session:not(.ready-to-book)")).toHaveCount(0);
  await student.getByText(/Past and canceled/).click();
  await expect(student.locator(".session-row.is-canceled")).toContainText("Clash with exam");
  expect((await api<Array<{ id: string; status: string }>>(ADMIN, "/requests")).find((r) => r.id === request.id)!.status).toBe("accepted");
});

test("resources: admin uploads a private file, student downloads it, visitors can't", async ({ browser }) => {
  const title = unique("Mock exam pack");
  const admin = await signedIn(browser, ADMIN);
  await admin.goto("/admin/resources");
  await admin.locator(".dropzone input[type=file]").setInputFiles({ name: "mock-exam.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e mock exam") });
  await admin.getByLabel("Title").fill(title);
  await admin.getByRole("button", { name: "Shared privately" }).click();
  await admin.locator(".student-picker").getByLabel(/Student User/).check();
  await admin.getByRole("button", { name: "Publish resource" }).click();
  await expect(admin.getByText("Resource published.")).toBeVisible();
  const card = admin.locator(".resource-card", { hasText: title });
  await expect(card.locator(".visibility-pill")).toHaveText("Shared privately (1)");

  const student = await signedIn(browser, STUDENT);
  await student.goto("/dashboard#resources");
  const mine = student.locator("#resources .resource-card", { hasText: title });
  await expect(mine).toBeVisible();
  const [download] = await Promise.all([student.waitForEvent("download"), mine.getByRole("button", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toBe("mock-exam.pdf");
  await expect(student).toHaveURL(/\/dashboard/);
  // The signed URL serves the exact bytes that were uploaded.
  const resource = (await api<Array<{ id: string; title: string }>>(STUDENT, "/resources")).find((r) => r.title === title)!;
  const { url } = await api<{ url: string }>(STUDENT, `/resources/${resource.id}/download`);
  expect(await (await fetch(url)).text()).toBe("%PDF-1.4 e2e mock exam");

  // Not visible signed out, and not downloadable by id.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/resources");
  await expect(visitor.getByText("Calculus formula sheet")).toBeVisible();
  await expect(visitor.getByText(title)).toHaveCount(0);
  const anon = await fetch(`http://localhost:4100/resources/${resource.id}/download`);
  expect(anon.status).toBe(404);

  // Admin edits then deletes it; the file goes with it.
  await card.getByRole("button", { name: "Edit" }).click();
  await admin.getByLabel("Title").fill(`${title} v2`);
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.locator(".resource-card", { hasText: `${title} v2` })).toBeVisible();
  admin.once("dialog", (d) => void d.accept());
  await admin.locator(".resource-card", { hasText: `${title} v2` }).getByRole("button", { name: "Delete" }).click();
  await expect(admin.locator(".resource-card", { hasText: `${title} v2` })).toHaveCount(0);
  expect((await fetch(url)).status).toBeGreaterThanOrEqual(400);
});

test("admin: home and About pages, with photo upload, drive the public site", async ({ browser }) => {
  const headline = unique("Physics that clicks");
  const admin = await signedIn(browser, ADMIN);
  await admin.goto("/admin/home");
  const home = admin.locator(".card", { has: admin.getByRole("heading", { name: "Headline and teaching style" }) });
  await home.getByLabel("Headline", { exact: true }).fill(headline);
  await home.getByRole("button", { name: "Save changes" }).click();
  await expect(home.getByText("Saved. The live site is updated.")).toBeVisible();

  await admin.goto("/admin/about");
  const about = admin.locator(".card", { has: admin.getByRole("heading", { name: "About page" }) });
  // 1x1 PNG
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await about.getByLabel("Upload photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await expect(about.getByText("Image uploaded.")).toBeVisible();
  await about.getByRole("button", { name: "Save changes" }).click();
  await expect(about.getByText("Saved. The live site is updated.")).toBeVisible();

  await admin.goto("/admin/contact");
  const contact = admin.locator(".card", { has: admin.getByRole("heading", { name: "Contact details" }) });
  await contact.getByLabel(/Public email/).fill("ramtin@tutor.test");
  await contact.getByRole("button", { name: "Save changes" }).click();
  await expect(contact.getByText("Saved. The live site is updated.")).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(headline);
  await expect(visitor.locator(".site-footer")).toContainText("ramtin@tutor.test");
  await visitor.goto("/about");
  await expect(visitor.locator(".about-photo")).toHaveAttribute("src", /\/storage\/v1\/object\/public\/site-media\//);
  expect(await visitor.locator(".about-photo").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
});

test("admin: edited assessment is what students take; admin sees the result", async ({ browser }) => {
  const question = unique("What is 7 × 8?");
  const admin = await signedIn(browser, ADMIN);
  await admin.goto("/admin/assessment");
  const panel = admin.locator(".card", { hasText: "Placement assessment (" });
  await panel.getByRole("button", { name: "Add question" }).click();
  const q = panel.locator(".question-edit").last();
  await q.getByLabel("Question", { exact: true }).fill(question);
  await q.getByLabel("Option 1", { exact: true }).fill("54");
  await q.getByLabel("Option 2", { exact: true }).fill("56");
  await q.getByLabel("Option 2 is correct").check();
  await q.getByLabel("Topic to recommend when missed").fill("Times tables");
  await panel.getByRole("button", { name: "Save assessment" }).click();
  await expect(panel.getByText("Assessment saved.")).toBeVisible();

  const student = await signedIn(browser, STUDENT);
  await student.goto("/assessment");
  await student.locator('select[name="subject"]').selectOption("Math");
  const fieldsets = await student.locator("#assessment-form fieldset").all();
  // Get every built-in question right (seeded answers) and miss the new one.
  for (const fieldset of fieldsets) {
    const legend = await fieldset.locator("legend").innerText();
    const answer = legend.includes(question) ? "54"
      : legend.includes("2x + 5") ? "6" : legend.includes("sin(30") ? "1/2" : legend.includes("Sequence") ? "48"
      : legend.includes("accelerates") ? "5 m/s²" : "3x²";
    await fieldset.getByLabel(answer, { exact: true }).check();
  }
  await student.getByRole("button", { name: "See My Result" }).click();
  await expect(student.locator("#assessment-result")).toContainText(`${fieldsets.length - 1} / ${fieldsets.length}`);
  await expect(student.locator("#assessment-result")).toContainText("Times tables");
  await expect(student.getByText("Saved to your dashboard.")).toBeVisible();

  await admin.goto(`/admin/students/${STUDENT}`);
  await expect(admin.locator(".card", { has: admin.getByRole("heading", { name: "Assessments" }) })).toContainText("Times tables");
});

test("students: admin assigns a course and shares material from the student record", async ({ browser }) => {
  const admin = await signedIn(browser, ADMIN);
  await admin.goto("/admin/students");
  await admin.getByRole("link", { name: "Student User" }).first().click();
  await expect(admin).toHaveURL(new RegExp(`/admin/students/${STUDENT}$`));
  await expect(admin.locator(".dashboard-hero")).toContainText("student@local.test");

  const courses = admin.locator(".card", { has: admin.getByRole("heading", { name: "Courses", exact: true }) });
  const assign = courses.locator('select[name="courseId"]');
  const courseTitle = (await assign.locator("option").nth(1).innerText()).replace(/ \(.*\)$/, "");
  await assign.selectOption({ index: 1 });
  await courses.getByRole("button", { name: "Assign" }).click();
  await expect(admin.getByText("Course assigned.")).toBeVisible();
  const row = courses.locator(".learner-course-row", { hasText: courseTitle });
  await row.getByRole("combobox").selectOption("in-progress");
  await expect(admin.getByText("Course status updated.")).toBeVisible();

  const student = await signedIn(browser, STUDENT);
  await expect(student.locator(".courses-overview", { hasText: courseTitle })).toContainText("In Progress");

  // Share an existing private resource (seeded for nobody else) from the record.
  const created = await api<{ id: string; title: string }>(ADMIN, "/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: unique("Vectors drill"), kind: "link", url: "https://openstax.org/", visibility: "private", studentIds: ["user_dev_new_student"] })
  });
  await admin.reload();
  const sharing = admin.locator(".card", { hasText: "Shared with" });
  await sharing.locator('select[name="resourceId"]').selectOption({ label: created.title });
  await sharing.getByRole("button", { name: "Share" }).click();
  await expect(sharing.locator(".list-item", { hasText: created.title })).toBeVisible();
  await student.reload();
  await expect(student.locator("#resources")).toContainText(created.title);
});

test("reviews and catalog: student review is moderated; admin course edits go live", async ({ browser }) => {
  const reviewText = unique("Finally understood torque");
  const student = await signedIn(browser, STUDENT);
  await student.goto("/");
  await student.locator(".review-overview summary").click();
  await student.locator('.review-overview textarea[name="text"]').fill(reviewText);
  await student.getByRole("button", { name: "Submit for approval" }).click();
  await expect(student.getByText("Your review will appear after approval")).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/");
  await expect(visitor.getByText(reviewText)).toHaveCount(0);

  const admin = await signedIn(browser, ADMIN);
  await admin.goto("/admin/reviews");
  const review = admin.locator("details.course-detail", { hasText: reviewText });
  await review.locator("summary").click();
  await review.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("Review approved.")).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByText(reviewText)).toBeVisible();

  const courseTitle = unique("Electromagnetism II");
  await admin.goto("/admin/courses");
  const editor = admin.locator(".card", { has: admin.getByRole("heading", { name: "Courses", exact: true }) });
  await editor.getByLabel("Title").first().fill(courseTitle);
  await editor.getByLabel("Topics / description").first().fill("Maxwell's equations, induction, waves.");
  await editor.getByRole("button", { name: "Add course" }).click();
  await expect(editor.getByText("Course added.")).toBeVisible();
  await visitor.goto("/courses");
  await expect(visitor.locator(".course-card", { hasText: courseTitle })).toBeVisible();
});

test("policies: admin edits the policy page", async ({ browser }) => {
  const title = unique("Cancellations & refunds");
  const admin = await signedIn(browser, ADMIN);
  await admin.goto("/admin/policy");
  const editor = admin.locator(".card", { has: admin.getByRole("heading", { name: "Policy page" }) });
  await editor.getByRole("button", { name: "+ Add section" }).click();
  const section = editor.locator(".section-editor").last();
  await section.getByLabel("Heading").fill(title);
  await section.getByLabel("Text").fill("Cancel 24 hours ahead for a full refund.\n\nLate cancellations are charged in full.");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(editor.getByText("Saved. The live site is updated.")).toBeVisible();
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/policy");
  const card = visitor.locator(".card", { hasText: title });
  await expect(card.locator("p")).toHaveCount(2);
});

test("access control: students can't reach admin pages or admin APIs", async ({ browser }) => {
  const student = await signedIn(browser, STUDENT);
  await student.goto("/admin");
  await expect(student).toHaveURL(/\/dashboard$/);
  await student.goto(`/admin/students/${STUDENT}`);
  await expect(student).toHaveURL(/\/dashboard$/);
  await expect(api(STUDENT, "/admin/users")).rejects.toThrow(/403/);
  await expect(api(STUDENT, "/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" })).rejects.toThrow(/403/);
  await expect(api(null, "/requests")).rejects.toThrow(/401/);
});

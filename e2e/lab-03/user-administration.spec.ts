import { test, expect, Page } from "@playwright/test";
import { API_URL } from "../../playwright.config.js";
import { ACCOUNTS, RUN, apiAs, deactivateCreatedUsers, fillLogin, logOut, signIn, trackCreatedUser } from "./helpers.js";

// E2E-08 to E2E-10 — the Administrator's journey and its boundaries
// (docs/lab-03/tests.md §2.13; AC-09, AC-30, AC-31, AC-32, AC-34).
//
// Users cannot be deleted (BR-50), so the accounts made here stay on the
// development database under run-unique emails, deactivated once the suite
// ends; no seeded account is changed.

test.afterAll(deactivateCreatedUsers);

const dialog = (page: Page) => page.getByRole("dialog");

async function searchFor(page: Page, text: string) {
  await page.getByLabel("Search name or email").fill(text);
}

async function changeForcedPassword(page: Page, current: string, next: string) {
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel(/^Current password/).fill(current);
  await page.getByLabel(/^New password/).fill(next);
  await page.getByLabel(/^Confirm new password/).fill(next);
  await page.getByRole("button", { name: "Save password" }).click();
}

test("E2E-08 an Administrator creates a user, who must change the password; a new initial password forces it again", async ({ page }) => {
  const email = `e2e.admin-made.${RUN}@example.test`;
  const fullName = `E2E Admin Made ${RUN}`;

  await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);
  await expect(page).toHaveURL(/\/users$/);
  await page.getByRole("button", { name: "+ Create user" }).click();
  await dialog(page).getByLabel(/^Full name/).fill(fullName);
  await dialog(page).getByLabel(/^Email/).fill(email);
  await dialog(page).getByRole("radio", { name: "Requester" }).check();
  await dialog(page).getByLabel(/^Initial password/).fill("First-initial#2026");
  await dialog(page).getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText(`Created ${fullName}. They must change the initial password at their next sign-in.`)).toBeVisible();
  trackCreatedUser(email);
  await searchFor(page, email);
  await expect(page.getByRole("row").filter({ hasText: email }).getByText("Active")).toBeVisible();
  await logOut(page);

  // First sign-in: straight to the forced change (AC-30). Leave without
  // changing it, so the session is still open when the admin acts.
  await fillLogin(page, email, "First-initial#2026");
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  // A session that was open before the reset, held by an API client.
  const heldOpen = await apiAs(email, "First-initial#2026");
  expect((await heldOpen.get("/api/auth/me")).status()).toBe(200);

  await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);
  await searchFor(page, email);
  await page.getByRole("row").filter({ hasText: email }).getByRole("button", { name: `Edit ${fullName}` }).click();
  await dialog(page).getByRole("button", { name: "Set new initial password" }).click();
  const confirm = page.getByRole("group", { name: "Set new initial password" });
  await expect(confirm).toContainText("This signs the user out everywhere and requires a password change at their next sign-in.");
  await confirm.getByLabel(/^New initial password/).fill("Second-initial#2026");
  await confirm.getByRole("button", { name: "Set password and sign out" }).click();
  await expect(page.getByText(`Set a new initial password for ${fullName}. They were signed out everywhere.`)).toBeVisible();
  await logOut(page);

  // The held session is gone and the old password no longer works (AC-34).
  expect((await heldOpen.get("/api/auth/me")).status()).toBe(401);
  await heldOpen.dispose();
  await fillLogin(page, email, "First-initial#2026");
  await expect(page.getByRole("alert")).toHaveText(/Email or password is incorrect\./);

  // The new one forces the change, then the user lands in the app.
  await fillLogin(page, email, "Second-initial#2026");
  await changeForcedPassword(page, "Second-initial#2026", "Their-own#2026");
  // Changed in Lab 4, Issue 7 (D-09): they land on the Dashboard.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("current-user")).toHaveText(fullName);
});

test("E2E-09 a duplicate email is refused, and an Administrator cannot remove themselves", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);

  // An email already in use, in different case, is refused on the field (AC-31).
  await page.getByRole("button", { name: "+ Create user" }).click();
  await dialog(page).getByLabel(/^Full name/).fill(`E2E Duplicate ${RUN}`);
  const emailField = dialog(page).getByLabel(/^Email/);
  await emailField.fill(ACCOUNTS.staff.email.toUpperCase());
  await dialog(page).getByRole("radio", { name: "IT Staff" }).check();
  await dialog(page).getByLabel(/^Initial password/).fill("Duplicate#2026");
  await dialog(page).getByRole("button", { name: "Create user" }).click();
  await expect(dialog(page).getByText("Another user already has this email.")).toBeVisible();
  await expect(emailField).toHaveAttribute("aria-invalid", "true");
  await page.keyboard.press("Escape");

  // The Administrator's own Role and Active are locked, with the reason (AC-32)…
  await searchFor(page, ACCOUNTS.admin.email);
  await page.getByRole("row").filter({ hasText: ACCOUNTS.admin.email }).getByRole("button", { name: `Edit ${ACCOUNTS.admin.name}` }).click();
  await expect(dialog(page).getByText("You cannot change your own role or deactivate yourself.")).toBeVisible();
  await expect(dialog(page).getByRole("switch", { name: "Active" })).toBeDisabled();
  for (const radio of await dialog(page).getByRole("radio").all()) await expect(radio).toBeDisabled();
  await page.keyboard.press("Escape");

  // …and the API refuses the same change sent directly, whatever the screen shows (FR-44).
  const admin = await apiAs(ACCOUNTS.admin.email);
  const users = (await (await admin.get("/api/admin/users", { params: { q: ACCOUNTS.admin.email } })).json()) as { users: { id: number }[] };
  const selfId = users.users[0].id;
  for (const data of [{ isActive: false }, { role: "IT_STAFF" }]) {
    const res = await admin.patch(`/api/admin/users/${selfId}`, { data });
    expect(res.status()).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("SELF_DEACTIVATION");
  }
  // An active Administrator always remains (AC-33).
  const admins = (await (await admin.get("/api/admin/users", { params: { role: "ADMINISTRATOR" } })).json()) as { users: { isActive: boolean }[] };
  expect(admins.users.filter((u) => u.isActive).length).toBeGreaterThanOrEqual(1);
  await admin.dispose();
});

test("E2E-10 a Requester typing /users is refused, and the API refuses too (AC-09)", async ({ page }) => {
  await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
  await page.goto("/users");
  await expect(page.getByText("You do not have access to that page.")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Create user" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "User Management" })).toHaveCount(0);

  const res = await page.request.get(`${API_URL}/api/admin/users`);
  expect(res.status()).toBe(403);
  const body = (await res.json()) as { error: { code: string }; users?: unknown };
  expect(body.error.code).toBe("FORBIDDEN");
  expect(body.users).toBeUndefined();
});

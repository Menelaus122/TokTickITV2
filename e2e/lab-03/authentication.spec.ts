import { test, expect } from "@playwright/test";
import { ACCOUNTS, RUN, SEED_PASSWORD, apiAs, deactivateCreatedUsers, fillLogin, logOut, signIn, trackCreatedUser } from "./helpers.js";

// E2E-01 to E2E-03 — signing in, the forced first password change, signing
// out, and the two refusals (docs/lab-03/tests.md §2.13; AC-01 to AC-05).

test.afterAll(deactivateCreatedUsers);

test.describe("E2E-01 sign in, see who you are, sign out", () => {
  test("a Requester signs in, sees name and role, logs out, and protected routes are then closed", async ({ page }) => {
    await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
    const banner = page.getByRole("banner");
    await expect(banner.getByText("Requester", { exact: true })).toBeVisible();
    // Changed in Lab 4, Issue 7 (D-09): the Requester lands on their Dashboard, which is the
    // first item of their navigation and marked as the current page. docs/lab-04/tests.md §6.
    await expect(page).toHaveURL(/\/dashboard$/);
    const navigation = page.getByRole("navigation", { name: "Main" });
    await expect(navigation.getByRole("link")).toHaveText(["Dashboard", "My Tickets", "Create Ticket"]);
    await expect(navigation.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    await logOut(page);

    // After logout a protected route goes back to Login, and the API agrees.
    await page.goto("/tickets");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.goto("/tickets/new");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    const me = await page.request.get(`${process.env.E2E_API_URL ?? "http://localhost:3000"}/api/auth/me`);
    expect(me.status()).toBe(401);
  });

  test("each role lands on its own screen and sees only its own navigation (AC-09)", async ({ page }) => {
    for (const [account, links] of [
      // Changed in Lab 4 (Issue 8, D-09): IT Staff and an Administrator land on their Dashboard,
      // the first item of their navigation and marked as the current page. An Administrator also
      // has the Ticket Queue (Issue 2, D-08). docs/lab-04/tests.md §6.
      [ACCOUNTS.staff, ["Dashboard", "Ticket Queue"]],
      [ACCOUNTS.admin, ["Dashboard", "Ticket Queue", "User Management"]],
    ] as const) {
      await signIn(page, account.email, account.name);
      await expect(page).toHaveURL(/\/dashboard$/);
      const navigation = page.getByRole("navigation", { name: "Main" });
      await expect(navigation.getByRole("link")).toHaveText([...links]);
      await expect(navigation.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
      await logOut(page);
    }
  });

  test("signing in after being sent away returns to the page that was asked for", async ({ page }) => {
    await page.goto("/queue");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.getByLabel(/^Email/).fill(ACCOUNTS.staff.email);
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/queue$/);
    await expect(page.getByTestId("current-user")).toHaveText(ACCOUNTS.staff.name);
  });
});

test.describe("E2E-02 the forced first password change", () => {
  test("an account with an initial password must change it before anything else, then lands in the app", async ({ page }) => {
    // A fresh account, so no seeded password is ever changed.
    const admin = await apiAs(ACCOUNTS.admin.email);
    const email = `e2e.firstlogin.${RUN}@example.test`;
    const fullName = `E2E First Login ${RUN}`;
    const created = await admin.post("/api/admin/users", {
      data: { fullName, email, role: "REQUESTER", isActive: true, initialPassword: "Initial#2026" },
    });
    expect(created.status()).toBe(201);
    trackCreatedUser(email);
    await admin.dispose();

    await fillLogin(page, email, "Initial#2026");
    await expect(page).toHaveURL(/\/change-password$/);
    await expect(page.getByLabel(/^Current password/)).toBeVisible();
    // Nothing else is reachable until the password changes (BR-14).
    await page.goto("/tickets");
    await expect(page).toHaveURL(/\/change-password$/);

    await page.getByLabel(/^Current password/).fill("Initial#2026");
    await page.getByLabel(/^New password/).fill("short");
    await page.getByLabel(/^Confirm new password/).fill("short");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText(/at least 8 characters/)).toBeVisible();

    await page.getByLabel(/^New password/).fill("Brand-new#2026");
    await page.getByLabel(/^Confirm new password/).fill("Brand-new#2026");
    await page.getByRole("button", { name: "Save password" }).click();
    // Changed in Lab 4, Issue 7 (D-09): the app they enter is the Dashboard.
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("current-user")).toHaveText(fullName);

    // The new password is the one that works from now on.
    await logOut(page);
    await signIn(page, email, fullName, "Brand-new#2026");
  });
});

test.describe("E2E-03 refusals", () => {
  test("a wrong password and an inactive account each get their own message", async ({ page }) => {
    // A run-unique email keeps this failure out of any seeded account's
    // throttle count (BR-67).
    await fillLogin(page, `e2e.nobody.${RUN}@example.test`, "Wrong-password#1");
    await expect(page.getByRole("alert")).toHaveText(/Email or password is incorrect\./);
    await expect(page).toHaveURL(/\/login/);

    await fillLogin(page, ACCOUNTS.inactiveRequester.email, SEED_PASSWORD);
    await expect(page.getByRole("alert")).toHaveText(/This account is not active\. Contact an administrator\./);
    await expect(page).toHaveURL(/\/login/);
  });

  test("an empty form is refused with a message beneath each field", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByLabel(/^Email/)).toHaveAttribute("aria-invalid", "true");
  });
});

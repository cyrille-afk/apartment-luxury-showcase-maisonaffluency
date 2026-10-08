/**
 * E2E: approved trade applicant activation journey
 *
 * Follows the activation link from a real approval email, sets a password,
 * and confirms trade portal access (UI + sign-in + role/profile records).
 *
 * Activation links are single-use, so this needs a fresh link per run:
 * approve (or "Resend activation email") for a controlled test inbox, copy the
 * "Activate" link from the email, then run:
 *
 *   E2E_ACTIVATION_URL='https://www.maisonaffluency.com/trade/activate?token_hash=…&type=recovery' \
 *   E2E_ACTIVATION_EMAIL='test-inbox@example.com' \
 *   PW_BASE_URL=https://www.maisonaffluency.com \
 *   bunx playwright test e2e/trade-activation-journey.spec.ts --project=desktop-chrome
 *
 * Skipped when the env vars are missing so CI stays green.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadDotEnv(path = ".env"): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/i);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

const env = { ...loadDotEnv(), ...process.env } as Record<string, string | undefined>;
const LINK = env.E2E_ACTIVATION_URL;
const EMAIL = env.E2E_ACTIVATION_EMAIL?.trim().toLowerCase();
const PASSWORD = env.E2E_ACTIVATION_PASSWORD || `Ma-e2e-${Date.now()}-Activate!`;

test.describe("Trade activation journey", () => {
  test.skip(!LINK || !EMAIL, "Set E2E_ACTIVATION_URL and E2E_ACTIVATION_EMAIL from a fresh approval email");

  test("email link → set password → trade portal access", async ({ page, baseURL }) => {
    test.setTimeout(120_000);

    // Run the link against the configured app origin (preview or production).
    const link = new URL(LINK!);
    expect(link.pathname).toBe("/trade/activate");
    expect(link.searchParams.get("type")).toBe("recovery");
    expect(link.searchParams.get("token_hash")).toBeTruthy();
    const target = new URL(link.pathname + link.search, baseURL);

    // 1. The link opens the activation page, not the application form.
    await page.goto(target.toString());
    await expect(page).toHaveURL(/\/trade\/activate/);
    await expect(page.getByRole("heading", { name: "Activate your trade access" })).toBeVisible();

    // 2. Exchange the one-time link; credential is stripped from the URL.
    await page.getByRole("button", { name: "Continue activation" }).click();
    await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(EMAIL!, { exact: false })).toBeVisible();
    expect(new URL(page.url()).search).toBe("");

    // 3. Validation guards.
    await page.getByLabel("New password").fill("short");
    await page.getByLabel("Confirm password").fill("short");
    await page.getByRole("button", { name: "Set password & activate" }).click();
    await expect(page.getByRole("alert")).toContainText("at least 12 characters");

    // 4. Set password and activate.
    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Set password & activate" }).click();

    // 5. Lands in the trade portal and stays there (no bounce to login/program).
    await expect(page).toHaveURL(/\/trade\/dashboard/, { timeout: 30_000 });
    await page.waitForTimeout(3_000);
    await expect(page).toHaveURL(/\/trade\/dashboard/);
    await expect(page.getByRole("alert")).toHaveCount(0);

    // 6. The new password signs in independently, and access records exist.
    const sb = createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: auth, error } = await sb.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD });
    expect(error).toBeNull();
    const uid = auth.user!.id;

    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", uid);
    expect((roles ?? []).map((r) => r.role)).toContain("trade_user");

    const { data: profile } = await sb.from("profiles").select("trade_status").eq("user_id", uid).maybeSingle();
    expect(profile?.trade_status).toBe("approved");

    // 7. Fresh browser sign-in with the new password reaches the portal.
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(new URL("/trade/login?next=/trade/dashboard", baseURL).toString());
    await page.locator('input[type="email"]').first().fill(EMAIL!);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('input[type="password"]').first().press("Enter");
    await expect(page).toHaveURL(/\/trade\/dashboard/, { timeout: 30_000 });

    // 8. The link is single-use.
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(target.toString());
    await page.getByRole("button", { name: "Continue activation" }).click();
    await expect(page.getByRole("alert")).toContainText(/invalid|expired|already used/i, { timeout: 20_000 });
  });
});

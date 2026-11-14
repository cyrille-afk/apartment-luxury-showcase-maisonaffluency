# Maison Affluency deployment checklist

Use a fresh copy of this checklist for each release. A GitHub sync, an applied database change, a backend deployment, a website publish, and a security scan are **separate actions**. Success in one does not prove the others happened.

## What each action does

| Action | What it confirms | What it does not confirm |
|---|---|---|
| GitHub sync | Saved code reaches the connected repository's synced branch | Database changes applied, backend functions deployed, website published, or security verified |
| Database changes | Required tables, permissions, policies, and database functions are applied to the intended backend | Backend code deployed or website published; a migration file in GitHub is not evidence it ran |
| Backend deployments | Changed backend functions are deployed and checked live | Database migrations applied or website published; GitHub sync does not deploy functions on Lovable Cloud |
| Website publish | The website release is available at the published address | Every database change or separately deployed backend function is current, or the release is secure |
| Security scans | The scanner's checks ran against the recorded code/backend state | Automatic fixes or a guarantee that all vulnerabilities were detected |

## 1. Identify the release

- [ ] Record the release date, responsible person, intended changes, and saved code revision.
- [ ] List required database changes and changed backend functions separately; mark a category **Not applicable** only when no changes are needed.
- [ ] Confirm the intended backend and website address. This project's preview and published website share the same Lovable Cloud backend; database and backend changes can affect the live website before publishing.
- [ ] For sensitive changes, record a recovery approach before making them. Restoring website code does not automatically undo database changes or backend deployments.

## 2. Save code and confirm GitHub sync

- [ ] Save/commit the intended changes.
- [ ] In **Project settings → Git**, verify the connected repository, synced branch, and sync status.
- [ ] Confirm the intended revision reached that branch; resolve any reported divergence before treating sync as complete.
- [ ] Do not interpret “synced” as “deployed” or “security checked.”

## 3. Apply and verify database changes

- [ ] Review only the migrations required for this release, including access policies and grants where relevant.
- [ ] Apply them through the project's supported database-change workflow; merely adding or syncing migration files does not apply them.
- [ ] Confirm successful application through migration history and live reads.
- [ ] Verify allowed access works and forbidden access is rejected using the affected signed-out, member, owner, or admin cases.
- [ ] Record the applied migration identifiers and verification evidence. Do not include credentials, private customer data, or access tokens.

## 4. Deploy and verify backend changes

- [ ] Explicitly deploy every changed existing backend function through Lovable; do not rely on GitHub sync for Lovable Cloud deployments.
- [ ] Confirm each deployment succeeded and record the function names and deployment evidence.
- [ ] Run a live startup check for each deployed function, then verify its changed behavior with safe test input.
- [ ] For ownership, payment, or credit changes, verify rejection cases as well as the permitted flow; avoid creating real charges or sending customer emails as test side effects.
- [ ] Check live errors without logging private addresses, tokens, or credentials.
- [ ] For TanStack server functions/routes, confirm their website release is published in step 6; these are not separately deployed legacy backend functions.

## 5. Security verification

- [ ] Run the quick database security scan before publishing and review non-dismissed findings.
- [ ] When a full security review is requested, also start the deep code security scan against saved changes.
- [ ] Wait for the deep scan's completion notification. A started scan or an older “complete” report does **not** verify the current release.
- [ ] Record each scan's timestamp, completion state, and whether its results are current; disclose any disabled deep-scan checks.
- [ ] For each targeted fix, record its finding ID, test/live evidence, and fresh scan outcome separately.
- [ ] Review new findings separately from the targeted fixes; do not fix, dismiss, or mark unrelated findings resolved without the appropriate scope/approval.
- [ ] Mark a finding fixed only after actually fixing and verifying it. Previously dismissed findings remain dismissed.
- [ ] If the deep scan is pending, report **Deep verification pending**, not “security verified” or “clean.” Scans do not replace penetration testing.

## 6. Publish and verify the website

- [ ] Confirm required database changes and separately deployed backend functions are ready for the website release.
- [ ] Publish the saved website release through Lovable's publishing controls.
- [ ] Open the actual published address and test the changed user flow, including sign-in when required, save/reload persistence, and denied-access cases.
- [ ] Check relevant desktop/phone behavior and live errors for affected screens.
- [ ] If anything changes after security verification, record that the earlier scan may be stale and recheck the affected scope.

## Release sign-off

Use **Verified**, **Pending**, **Failed**, or **Not applicable**. Never check a step based solely on another step's success.

| Area | Status | Evidence / timestamp |
|---|---|---|
| Saved code revision and GitHub sync | Pending | |
| Database changes applied and access verified | Pending | |
| Changed backend functions deployed and live checked | Pending | |
| Quick security scan | Pending | |
| Deep security scan, if requested | Pending | |
| Targeted security fixes individually verified | Pending | |
| Newly surfaced findings reviewed separately | Pending | |
| Website published and live user flow verified | Pending | |

**Outstanding items and responsible person:**

**Release decision and any explicitly accepted limitations:**
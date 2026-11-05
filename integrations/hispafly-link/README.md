# TASK 006 — TIRIO ↔ HISPAFLY account linking

## Delivery and activation boundary

This is a **disabled-by-default, locally tested integration**, not an installed Shopify app and not a deployed feature. The Liquid shop stays on Shopify Online Store 2.0; no frontend migration, paid app or Shopify Plus is required by this design. The independent service does not log a customer into Shopify using HISPAFLY. It associates two independently verified identities.

Only `tirio-store` is changed. No HISPAFLY repository, production database, VPS, DNS, customer records, inventory, payment, tax or shipping settings are modified. The proposed HISPAFLY adapter is supplied under `hispafly-adapter/route.ts` for a **separately reviewed source change** to that project. The existing no-other-repository/no-production-change boundary is preserved. Neither the connected `shopify-preview` branch nor the theme is updated by this feature PR.

## Source audit

- TIRIO source: `shopify-preview` at `b6724883f62af7e44f0effa75fe55ba3ec084989`, theme directories at repository root. There was no account-linking backend or app configuration.
- HISPAFLY read-only audit: main at `cf9f483ab601d9fa1689b0ffbf84195b1230e511`. `src/lib/auth/session.ts` exposes `currentAuthUser()` and host-only HTTP-only native sessions; `src/app/api/auth/local/me/route.ts` returns native identity. The code inspected does not provide the complete third-party authorization flow required here.
- The adapter reuses native `AuthUser.id`, `emailVerifiedAt`, active account and pilot status, and PILOT role. No email-based automatic match, password copy, shared domain cookies or retired vAMSYS OAuth/API is used. Repository source is not evidence of the live deployment version; that must be verified before installing the adapter.

## Components

| Component | Location | Purpose |
| --- | --- | --- |
| Theme entry | `sections/hispafly-membership.liquid`, `templates/page.hispafly.json` | Optional explanatory page, disabled and with no service URL by default |
| Broker | `src/` in this folder | Shopify identity proof, short-lived linking flows, final confirmation, status and unlink |
| Proposed HISPAFLY route | `hispafly-adapter/route.ts` | Shows consent on HISPAFLY and authorizes the native logged-in pilot through a signed backchannel grant |
| SQLite | Server-private persistent path | Account-ID mapping, short-lived sessions/flows and audit records; no passwords or Shopify orders |

The proposed live broker hostname is **not assigned**. Choose one later; do not configure it on top of an existing service. The actual AOC origin is also a required deployment input, not inferred from repository names.

## Flow and trust boundaries

1. The user opens the broker. It creates a random host-only session cookie and browser-bound Shopify verification state.
2. The user follows a link to the store's installed app proxy. Shopify signs the shop, authenticated customer ID, state and timestamp. The broker validates the signature, configured shop, freshness and nonempty numeric customer ID. No browser-provided email/customer ID is trusted.
3. The proxy returns an HTML continuation link with a short-lived one-use proof code. It does not try to set cookies through Shopify (proxy cookies are stripped). The continuation code must match the original broker session. The session cookie is rotated only after completing this proof. A pending customer ID cannot authorize any action.
4. The user explicitly requests linking on the broker. It sends a five-minute, purpose-bound signed request to the configured HISPAFLY authorization route. The callback origin is fixed, never taken from an untrusted return URL.
5. HISPAFLY requires an active, email-verified pilot account and shows the consent page. If login is needed, the user signs into the existing site in another tab and refreshes the consent page. This avoids modifying HISPAFLY's current login/return handling.
6. Consent POST requires the exact HISPAFLY Origin and a request/user-bound CSRF proof. The adapter calls the broker server-to-server with an authenticated, purpose-bound grant. The broker only accepts a still-pending flow and creates a one-use callback code valid for 60 seconds.
7. The callback verifies the original browser session and flow, consumes the code, and shows both account IDs. **The callback alone never saves a link.** The user performs a final CSRF-protected confirmation POST.
8. A transaction enforces one Shopify customer ↔ one native HISPAFLY identity per shop. Conflicts never silently overwrite another link. Unlink is authenticated, POST-only and CSRF-protected; it removes the mapping and pending flows for that customer, not either source account. Broker logout revokes the broker session.

This is a narrowly scoped signed linking handshake, **not an OAuth/OIDC provider**. It creates no Shopify SSO session and makes no claim to implement generic OAuth. No API endpoint exposing arbitrary customer/member mappings exists.

## Data and membership behavior

`links`: shop, Shopify customer ID, native HISPAFLY user ID, created timestamp. No emails, names, passwords, flight records, wallet balances, orders or addresses are copied. Sessions store token hashes; callback codes are stored as hashes. Sessions expire in 20 minutes; pending flows in five minutes; expired rows are purged on requests. Hash-only audit subjects use the session secret and are retained for 30 days; unlink removes the mapping immediately but retains that minimal audit trail until expiry.

Membership eligibility is checked at authorization time. A stored association is **not** proof of continuing active membership and does not grant discounts, purchases, staff access or reservations. Any future member benefit needs fresh server-side eligibility verification and its own authorization rules. Suspended/deleted identities must not retain benefits based only on this mapping. Account-deletion reconciliation/webhooks and automatic discount integration are intentionally not implemented; define and test those before enabling benefits.

SQLite is suitable here for a small, single-instance association service. Use a persistent private disk and one broker process. Do not place the file on ephemeral/serverless storage or in the theme/public directory. No external database is provisioned and no production schema migration is run. Move to a managed database only if deployment/scale needs justify it.

## Local validation (no credentials, customers or email sent)

Requires Node.js 24+. There are **zero runtime npm dependencies**.

```sh
node --test integrations/hispafly-link/test/*.test.mjs
node scripts/check-theme.cjs
node --check integrations/hispafly-link/src/server.mjs
npx --yes --package @shopify/cli shopify theme check --path .
git diff --check
```

The integration tests use actual broker handlers, SQLite and the actual proposed adapter source. Only the HISPAFLY native-user lookup and HTTP transport are replaced with local fixtures. Shopify signatures are generated locally; no signed-in browser, store app or live customer is used. Adapter tests use Node's experimental TypeScript stripping solely to load the proposed TypeScript source, not as its production deployment path.

Coverage: successful proof/consent/confirmation/unlink; HMAC tampering, wrong shop, expired request, missing customer, duplicate parameters, CSRF, Origin, absent consent, inactive/unverified/nonpilot accounts, grant/code replay, cross-browser callbacks, callback-without-final-confirmation, one-to-one conflicts, session rotation/logout, data persistence across restart, disabled feature and security headers.

## Required external setup — not performed

1. **Shopify app:** Create/install a merchant-owned application with `write_app_proxy`, using the supported Dev Dashboard/app installation process. No Admin API customer write/read token is required by this broker. Obtain the actual app client secret privately. Configure storefront proxy `/apps/hispafly-link` → `https://BROKER-HOST/proxy`. The sample path is configurable. Keep the URL exact: the broker serves `/proxy`, not arbitrary subpaths. App creation/install/credentials are an activation step, not completed by committing this code.
2. **Customer accounts:** Enable native customer accounts separately if desired and test a real logged-in customer through the proxy. Shopify must supply `logged_in_customer_id`; the broker deliberately fails closed when absent. Do not fall back to matching emails or a Liquid/browser customer ID. Account settings were not changed by this task.
3. **HISPAFLY source:** Review/copy the proposed adapter into `src/app/api/integrations/tirio/authorize/route.ts` in a dedicated HISPAFLY PR. Read that repository's AGENTS.md first. Verify the live source/types/session eligibility and run its own type/build checks before any deployment. Add `TIRIO_LINK_ENABLED=false`, `TIRIO_LINK_ORIGIN`, `TIRIO_LINK_SECRET` and `HISPAFLY_PUBLIC_ORIGIN` privately to that service's deployment configuration. Do not deploy as part of this PR. The shared secret must match broker `HISPAFLY_LINK_SECRET`.
4. **Broker hosting:** Approve an isolated Node 24 service, dedicated HTTPS hostname/reverse-proxy route and persistent private disk. No VPS service should be stopped or changed to make room without separate review. The service binds only to `127.0.0.1`; TLS terminates at the approved proxy. Forward real Origin unchanged; do not trust user-forwarded identity headers. Restrict inbound access, use edge rate limits, redact query strings on `/proxy`, `/shopify/callback`, `/hispafly/callback` and HISPAFLY authorization URLs from logs. The built-in limiter keys on the socket peer (not spoofable forwarded headers); configure appropriate edge limits for production proxy topology.
5. **Secrets:** Copy `.env.example` locally, replace all placeholders and use three distinct strong random secrets (at least 32 characters). Keep them out of Git, browsers and Shopify theme settings. `LINK_ENABLED` and `TIRIO_LINK_ENABLED` remain false until approved integration testing. The server rejects incomplete/placeholder secrets and non-HTTPS production origins. Never share a session cookie on `.hispafly.es`.
6. **Privacy:** Review both privacy policies before activation. Explain the two operators, purpose, minimal identifiers, optional linking, unlink/deletion, retention and any sharing relationship accurately. Confirm HISPAFLY's `/privacy` and Shopify's policy are actually reachable and correct. The technical consent step is not a substitute for deciding/recording the applicable legal basis. This PR does not edit published policies or collect real member data.
7. **Theme entry:** After the service and adapter pass live draft-store testing, create a page assigned to `page.hispafly`, set the broker HTTPS URL and enable `Miembros HISPAFLY`. Add a navigation link manually if wanted. The theme contains no fake linked state and no activation by default. No existing merchant templates/settings are overwritten.

## Hosting, backup and shutdown

Run manually only after infrastructure approval:

```sh
cd integrations/hispafly-link
# Load the reviewed private environment using your service manager.
npm start
```

Back up SQLite with its online backup facility or a consistent shutdown copy including WAL handling; do not copy only the live main file while ignoring its WAL. Store encrypted backups with restricted access and a defined retention policy. Restore-test with synthetic data before activation. Disable both flags and hide the theme block to stop new linking, retain mappings only under the declared retention policy, and revoke/rotate app/shared secrets if compromised. Changing `LINK_SESSION_SECRET` invalidates form proofs/audit pseudonym correlation; end existing sessions and flows when rotating it.

## Remaining acceptance tests

Not performed: installation on the actual Shopify plan, actual app-proxy/new-customer-account behavior, live cookies across the configured origins, real HISPAFLY login, actual customer consent, browser/mobile visual and keyboard/screen-reader QA, TLS/proxy/log behavior, production backups, and HISPAFLY full type/build checks. These require the external app and approved source/hosting setup above. Until then this is a tested code deliverable, **not an operational account-linking feature**.

## Unrelated integration opt-out

The root `vercel.json` contains only `git.deploymentEnabled: false` to stop the repository's pre-existing unrelated Git integration from automatically deploying this feature branch. No Vercel service/API/CLI is used, no hosting resources are provisioned, and there is no Vercel runtime dependency. This is an opt-out guard, not a hosting migration. Do not merge/update `shopify-preview` automatically.

## Primary references checked 5 November 2026

- Shopify app proxies and required app scope: https://shopify.dev/docs/apps/build/online-store/app-proxies
- Signed proxy identity and cookie restrictions: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
- Shopify external identity-provider SSO is Plus-only (distinct from this linking flow): https://help.shopify.com/en/manual/customers/customer-accounts/sign-in-options/identity-provider
- Opt-out of pre-existing unrelated Git deployments: https://vercel.com/docs/project-configuration/git-configuration

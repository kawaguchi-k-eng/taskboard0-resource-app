# Taskboard0 — demo Cross App Access resource app

A tiny, self-hosted Linear-style issue tracker that plays the **resource
app** role in an Okta Cross App Access (XAA) demo. It exists so the full
XAA flow (and the `linear-xaa-agent` project) can be demoed end to end
without depending on a commercial app's paid SSO tier (Linear's own XAA
support turned out to be gated behind a SAML SSO plan tier).

Next.js App Router + TypeScript + npm, so it deploys to AWS Amplify Hosting
with no code changes — see [Deploying to AWS Amplify](#deploying-to-aws-amplify).

## What it implements

- `POST /oauth/token` — the JWT Bearer authorization grant (RFC 7523).
  Accepts an ID-JAG (minted by the customer's Okta org for this app's
  audience) and returns a scoped access token. See `src/lib/verify-id-jag.ts`
  and `src/app/oauth/token/route.ts`.
- `GET /.well-known/oauth-authorization-server` — RFC 8414 metadata,
  advertising the jwt-bearer grant type for protocol-accurate discovery.
- `GET/POST /api/v1/teams`, `/api/v1/issues`, `/api/v1/issues/[id]`,
  `/api/v1/workflow-states` — the protected API, gated by the access token
  from `/oauth/token` (see `src/lib/require-access-token.ts`).
- `GET /` — a live kanban board (polls `/api/board-snapshot`, unauthenticated,
  demo-only) so you can watch the agent's changes land in real time.

## Trust model

This server validates every incoming ID-JAG against:

1. **Signature** — fetched from the trusted Okta **org** authorization
   server's published JWKS (never a custom one — see the gotcha below).
2. **Issuer** — must exactly match the org authorization server's root. An
   otherwise-valid JWT from any other issuer is rejected with
   `invalid_grant`, never accepted on signature alone.
3. **Audience** — must match `RESOURCE_AUDIENCE`, this app's own identifier.
4. **`client_id`** — must be in `TRUSTED_REQUESTING_APP_CLIENT_IDS`, i.e. a
   requesting app you explicitly agreed to accept calls from.

It then self-issues its own short-lived signed access token (HS256, see
`src/lib/access-token.ts`) — this app is both the authorization server and
the resource server, so there's no need for opaque tokens or a session
store.

## Hard-won gotchas setting this up against real Okta

These cost real debugging time against a live Okta org — worth knowing up front:

- **ID-JAGs are only minted and verified via the org authorization server**
  (`https://{yourOktaDomain}/oauth2/v1/...`), never a custom one like
  `/oauth2/default` — even though `/oauth2/default` is correct for normal
  sign-in. Both this app (`src/lib/verify-id-jag.ts`) and the requesting app
  derive the org root from `OKTA_ISSUER` automatically; override with
  `OKTA_ORG_ISSUER`/`OKTA_JWKS_URI` only if that guess is wrong.
- **In Okta's XAA "Callers" config on this app, the `audience` parameter the
  requesting app sends is the "Issuer URL" field, not "Audience/tenant ID".**
  "Audience/tenant ID" becomes the `aud` claim *inside* the ID-JAG (what
  `RESOURCE_AUDIENCE` here checks); "Issuer URL" is the value Okta expects as
  the `audience`/`resource` request parameter.
- **"Issuer URL" must be a real, Okta-reachable URL** — Okta's own field
  description says it's used "for token verification requests," and it
  means it. A placeholder domain (even one that merely passes the UI's
  save-time validation, like rejecting `localhost` but accepting anything
  else) will fail silently at request time with a confusing
  `access_denied: User is not assigned to the client application` error.
  Once this app is deployed somewhere real, use that URL for both "Issuer
  URL" and "Audience/tenant ID" (i.e. same value as `RESOURCE_AUDIENCE`).
- **The signed-in user must be assigned to BOTH apps** — the requesting
  app *and* this resource app's own Okta Application object (`Applications
  > Taskboard0 > Assignments`), even though this app has no interactive
  sign-in flow of its own.

## Setup

```bash
npm install
cp .env.local.example .env.local
# fill in OKTA_ISSUER, RESOURCE_AUDIENCE, TRUSTED_REQUESTING_APP_CLIENT_IDS,
# and ACCESS_TOKEN_SIGNING_SECRET (openssl rand -base64 32)
npm run dev   # listens on :3000 by default; run linear-xaa-agent on another port
```

Okta-side setup (summarized — see the gotchas above for the parts that bite):

1. `Settings > Features > Early access > Cross App Access` → enable.
2. Register this app in Okta as a generic Custom OIDC app, "Taskboard0".
3. On it: `Machine Assignments > Callers > Cross App Access (XAA) > Enable`.
   Set **Issuer URL** and **Audience/tenant ID** to this app's real deployed
   URL (same value as `RESOURCE_AUDIENCE`). Add `read`/`write` scopes.
4. Assign your test user to this app (`Applications > Taskboard0 >
   Assignments`).
5. On the requesting app's AI agent: `Directory > AI Agents > <agent> >
   Resource connections > Add resource connection`, pointing at Taskboard0,
   with a **Resource identifier** matching `RESOURCE_AUDIENCE` and an
   **External client ID** matching one of `TRUSTED_REQUESTING_APP_CLIENT_IDS`.

## Deploying to AWS Amplify

Stock Next.js App Router project — Amplify Hosting builds and serves it,
API routes included, via the included `amplify.yml`.

**Important**: Amplify Console environment variables are build-phase only
by default — Next.js server code can't see them at request time unless
they're written into `.env.production` during the build. `amplify.yml`
already does this for this app's required vars. If you add a new env var,
add its name to the `env | grep -e ...` line in `amplify.yml` too, or it'll
silently read as `undefined` at runtime no matter how many times you
redeploy. (Clicking "Redeploy this version" reuses the old build output and
won't pick up env var changes either — push a new commit, or use whatever
"start a new build" action your Amplify console offers.)

Set `RESOURCE_AUDIENCE` to this app's own deployed URL, and use that same
URL for Okta's "Issuer URL" and "Audience/tenant ID" fields (see gotchas
above).

## Known limitations of this demo

- All data lives in an in-memory `Map`/array (`src/lib/store.ts`). It resets
  on cold start and isn't shared across concurrent Lambda instances on
  Amplify. Swap for DynamoDB or similar before relying on persistence.
- Access tokens are self-signed with a single shared secret
  (`ACCESS_TOKEN_SIGNING_SECRET`) rather than per-tenant keys — fine for a
  single-org demo, not a multi-tenant SaaS pattern. Note that with the
  current `amplify.yml`, this secret ends up baked into the build artifact
  (see the AWS doc on SSR env vars) — acceptable for a demo, not for
  anything handling real credentials.

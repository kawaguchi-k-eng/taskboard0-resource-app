# Taskboard0 — demo Cross App Access resource app

A tiny, self-hosted Linear-style issue tracker that plays the **resource
app** role in an Okta Cross App Access (XAA) demo. It exists so the full
XAA flow (and the `linear-xaa-agent` project) can be demoed end to end
without depending on a commercial app's paid SSO tier.

Next.js App Router + TypeScript + npm, so it deploys to AWS Amplify Hosting
unchanged via the included `amplify.yml`.

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

1. **Signature** — fetched from the trusted Okta org's published JWKS.
2. **Issuer** — must exactly match `OKTA_ISSUER`. An otherwise-valid JWT from
   any other issuer is rejected with `invalid_grant`, never accepted on
   signature alone.
3. **Audience** — must match `RESOURCE_AUDIENCE`, this app's own identifier.
4. **`client_id`** — must be in `TRUSTED_REQUESTING_APP_CLIENT_IDS`, i.e. a
   requesting app you explicitly agreed to accept calls from.

It then self-issues its own short-lived signed access token (HS256, see
`src/lib/access-token.ts`) — this app is both the authorization server and
the resource server, so there's no need for opaque tokens or a session
store.

## Setup

```bash
npm install
cp .env.local.example .env.local
# fill in OKTA_ISSUER, RESOURCE_AUDIENCE, TRUSTED_REQUESTING_APP_CLIENT_IDS,
# and ACCESS_TOKEN_SIGNING_SECRET (openssl rand -base64 32)
npm run dev   # listens on :3000 by default; run on :3001 alongside linear-xaa-agent
```

To wire this up as the resource app in Okta's XAA connection setup
(`Directory > AI Agents > <agent> > Resource connections`):

- **Resource identifier** → `RESOURCE_AUDIENCE`
- **`{agent}` client ID registered in Taskboard0** → one of the values in
  `TRUSTED_REQUESTING_APP_CLIENT_IDS`

And in `linear-xaa-agent`'s `.env.local`, point `LINEAR_TOKEN_URL` at
`http://localhost:3001/oauth/token` (or wherever this app is deployed) and
`LINEAR_RESOURCE_IDENTIFIER` at the same `RESOURCE_AUDIENCE` value.

## Deploying to AWS Amplify

Stock Next.js App Router project — Amplify Hosting builds and serves it,
API routes included, via the included `amplify.yml`. Set the same
environment variables from `.env.local` in the Amplify app's environment
variable settings, with `RESOURCE_AUDIENCE` set to the deployed URL.

## Known limitations of this demo

- All data lives in an in-memory `Map`/array (`src/lib/store.ts`). It resets
  on cold start and isn't shared across concurrent Lambda instances on
  Amplify. Swap for DynamoDB or similar before relying on persistence.
- Access tokens are self-signed with a single shared secret
  (`ACCESS_TOKEN_SIGNING_SECRET`) rather than per-tenant keys — fine for a
  single-org demo, not a multi-tenant SaaS pattern.

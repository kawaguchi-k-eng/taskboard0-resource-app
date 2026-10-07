import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

export class IdJagValidationError extends Error {}

export type VerifiedIdJag = JWTPayload & {
  sub: string;
  client_id?: string;
  cid?: string;
};

type TrustedIssuerConfig = {
  issuer: string;
  jwksUri: string;
};

/**
 * This resource app's own identity: the audience the ID-JAG must be issued
 * for, and the requesting-app client_id(s) it accepts calls from. Both are
 * set when you create the XAA resource connection in Okta.
 */
function getOwnAudience(): string {
  const value = process.env.RESOURCE_AUDIENCE;
  if (!value) throw new Error('Missing RESOURCE_AUDIENCE environment variable');
  return value;
}

function getTrustedIssuer(): TrustedIssuerConfig {
  // The ID-JAG is minted by Okta's ORG authorization server (never a custom
  // one like /oauth2/default, even though that's correct for normal
  // sign-in) — so its `iss` and signing key both come from the org root,
  // not from OKTA_ISSUER as configured for sign-in.
  const configuredIssuer = process.env.OKTA_ISSUER;
  if (!configuredIssuer) throw new Error('Missing OKTA_ISSUER environment variable');
  const orgRoot = new URL(configuredIssuer).origin;

  return {
    issuer: process.env.OKTA_ORG_ISSUER ?? orgRoot,
    jwksUri: process.env.OKTA_JWKS_URI ?? `${orgRoot}/oauth2/v1/keys`,
  };
}

function getTrustedClientIds(): string[] {
  const raw = process.env.TRUSTED_REQUESTING_APP_CLIENT_IDS;
  if (!raw) throw new Error('Missing TRUSTED_REQUESTING_APP_CLIENT_IDS environment variable');
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(jwksUri: string) {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

/**
 * Validate an incoming Identity Assertion JWT Authorization Grant (ID-JAG):
 * - signature, verified against the trusted IdP's published JWKS
 * - issuer, must be our single allowlisted Okta org (never accept an
 *   unlisted issuer, even with a valid signature)
 * - audience, must be this resource app's own identifier
 * - expiry
 * - the embedded client_id, must be a requesting app we've explicitly agreed
 *   to accept calls from (the "external client ID" configured in the Okta
 *   XAA resource connection)
 */
export async function verifyIdJag(idJag: string): Promise<VerifiedIdJag> {
  const { issuer, jwksUri } = getTrustedIssuer();
  const audience = getOwnAudience();
  const trustedClientIds = getTrustedClientIds();

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(idJag, getJwks(jwksUri), {
      issuer,
      audience,
    });
    payload = result.payload;
  } catch (error) {
    throw new IdJagValidationError(
      `ID-JAG signature/claims validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (process.env.DEBUG_LOG_ID_JAG_CLAIMS === 'true') {
    // Opt-in diagnostic: see exactly what a given Okta org puts in the
    // ID-JAG (e.g. the client_id/cid claim) before deciding
    // TRUSTED_REQUESTING_APP_CLIENT_IDS. Off by default.
    console.log('[verify-id-jag] decoded ID-JAG payload:', payload);
  }

  if (!payload.sub) {
    throw new IdJagValidationError('ID-JAG is missing the sub (subject) claim');
  }

  const clientId = (payload.client_id as string | undefined) ?? (payload.cid as string | undefined);
  if (!clientId || !trustedClientIds.includes(clientId)) {
    throw new IdJagValidationError(
      `ID-JAG client_id '${clientId}' is not in the trusted requesting-app allowlist`
    );
  }

  return payload as VerifiedIdJag;
}

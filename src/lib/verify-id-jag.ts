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
  const issuer = process.env.OKTA_ISSUER;
  if (!issuer) throw new Error('Missing OKTA_ISSUER environment variable');
  return {
    issuer,
    jwksUri: process.env.OKTA_JWKS_URI ?? `${issuer}/v1/keys`,
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
    // Temporary: inspect the real claims Okta puts in the ID-JAG so we can
    // set TRUSTED_REQUESTING_APP_CLIENT_IDS to the right value. Remove once
    // confirmed.
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

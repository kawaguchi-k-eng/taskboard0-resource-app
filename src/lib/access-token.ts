import { jwtVerify, JWTPayload, SignJWT } from 'jose';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

function getSigningSecret(): Uint8Array {
  const secret = process.env.ACCESS_TOKEN_SIGNING_SECRET;
  if (!secret) throw new Error('Missing ACCESS_TOKEN_SIGNING_SECRET environment variable');
  return new TextEncoder().encode(secret);
}

export type AccessTokenClaims = {
  sub: string;
  client_id: string;
  scope: string;
};

/**
 * This resource app acts as both the authorization server and the API, so
 * it can self-issue a signed access token after validating the ID-JAG,
 * rather than tracking opaque tokens in a session store.
 */
export async function issueAccessToken(claims: AccessTokenClaims): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const accessToken = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .setIssuer(process.env.RESOURCE_AUDIENCE ?? 'taskboard0')
    .sign(getSigningSecret());

  return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export class AccessTokenValidationError extends Error {}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims & JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, getSigningSecret());
    return payload as AccessTokenClaims & JWTPayload;
  } catch (error) {
    throw new AccessTokenValidationError(
      `Access token validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
  return match ? match[1] : null;
}

import { NextRequest, NextResponse } from 'next/server';
import { AccessTokenClaims, AccessTokenValidationError, extractBearerToken, verifyAccessToken } from './access-token';

export async function requireAccessToken(
  req: NextRequest
): Promise<{ claims: AccessTokenClaims } | { response: NextResponse }> {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) {
    return {
      response: NextResponse.json(
        { error: 'unauthorized', error_description: 'Missing Bearer token' },
        {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer realm="taskboard0"' },
        }
      ),
    };
  }

  try {
    const claims = await verifyAccessToken(token);
    return { claims };
  } catch (error) {
    if (error instanceof AccessTokenValidationError) {
      return {
        response: NextResponse.json(
          { error: 'invalid_token', error_description: error.message },
          {
            status: 401,
            headers: { 'WWW-Authenticate': 'Bearer realm="taskboard0", error="invalid_token"' },
          }
        ),
      };
    }
    throw error;
  }
}

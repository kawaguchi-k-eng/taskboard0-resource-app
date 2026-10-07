import { NextRequest, NextResponse } from 'next/server';
import { issueAccessToken } from '@/lib/access-token';
import { IdJagValidationError, verifyIdJag } from '@/lib/verify-id-jag';

const JWT_BEARER_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

/**
 * Token endpoint for this resource app's authorization server.
 *
 * Implements the JWT Bearer authorization grant (RFC 7523): a requesting
 * app presents an Identity Assertion JWT Authorization Grant (ID-JAG) minted
 * by the customer's Okta org, and receives back a scoped access token for
 * this API, with no user-facing consent step.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return oauthError('invalid_request', 'Expected application/x-www-form-urlencoded body');
  }

  const form = new URLSearchParams(await req.text());
  const grantType = form.get('grant_type');
  const assertion = form.get('assertion');
  const requestedScope = form.get('scope') ?? '';

  if (grantType !== JWT_BEARER_GRANT_TYPE) {
    return oauthError(
      'unsupported_grant_type',
      `Only '${JWT_BEARER_GRANT_TYPE}' is supported at this endpoint`
    );
  }

  if (!assertion) {
    return oauthError('invalid_request', 'Missing assertion parameter');
  }

  let idJag;
  try {
    idJag = await verifyIdJag(assertion);
  } catch (error) {
    if (error instanceof IdJagValidationError) {
      return oauthError('invalid_grant', error.message);
    }
    throw error;
  }

  const clientId = (idJag.client_id as string) ?? (idJag.cid as string);

  const { accessToken, expiresIn } = await issueAccessToken({
    sub: idJag.sub,
    client_id: clientId,
    scope: requestedScope,
  });

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: requestedScope,
  });
}

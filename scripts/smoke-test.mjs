// End-to-end smoke test, run against a local `next dev`/`next start` instance:
// mints a fake "Okta-signed" ID-JAG using a throwaway RSA keypair served from
// a tiny local JWKS endpoint, exchanges it at /oauth/token, then calls the
// protected API with the resulting access token.
import { createServer } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const RESOURCE_PORT = process.env.RESOURCE_PORT ?? 3000;
const BASE_URL = `http://localhost:${RESOURCE_PORT}`;
const MOCK_OKTA_PORT = 4100;
const MOCK_OKTA_ISSUER = `http://localhost:${MOCK_OKTA_PORT}`;
const RESOURCE_AUDIENCE = process.env.RESOURCE_AUDIENCE ?? BASE_URL;
const TRUSTED_CLIENT_ID = (process.env.TRUSTED_REQUESTING_APP_CLIENT_IDS ?? '').split(',')[0];

async function main() {
  if (!TRUSTED_CLIENT_ID) {
    throw new Error('Set TRUSTED_REQUESTING_APP_CLIENT_IDS before running this script');
  }

  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key-1';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const mockIdp = createServer((req, res) => {
    if (req.url === '/v1/keys') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise((resolve) => mockIdp.listen(MOCK_OKTA_PORT, resolve));
  console.log(`Mock Okta JWKS serving at ${MOCK_OKTA_ISSUER}/v1/keys`);
  console.log('>>> Make sure the resource app is running with:');
  console.log(`    OKTA_ISSUER=${MOCK_OKTA_ISSUER} OKTA_JWKS_URI=${MOCK_OKTA_ISSUER}/v1/keys RESOURCE_AUDIENCE=${RESOURCE_AUDIENCE}`);

  try {
    const idJag = await new SignJWT({
      client_id: TRUSTED_CLIENT_ID,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(MOCK_OKTA_ISSUER)
      .setAudience(RESOURCE_AUDIENCE)
      .setSubject('user_123')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    console.log('\n1. Exchanging fake ID-JAG for an access token at /oauth/token ...');
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: idJag,
        scope: 'read write',
      }),
    });
    const tokenBody = await tokenRes.json();
    console.log(`   status=${tokenRes.status}`, tokenBody);
    if (!tokenRes.ok) throw new Error('Token exchange failed');

    console.log('\n2. Calling GET /api/v1/teams with the access token ...');
    const teamsRes = await fetch(`${BASE_URL}/api/v1/teams`, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    console.log(`   status=${teamsRes.status}`, await teamsRes.json());
    if (!teamsRes.ok) throw new Error('Authenticated API call failed');

    console.log('\n3. Confirming a request with NO token is rejected ...');
    const noAuthRes = await fetch(`${BASE_URL}/api/v1/teams`);
    console.log(`   status=${noAuthRes.status} (expect 401)`);
    if (noAuthRes.status !== 401) throw new Error('Expected 401 without a token');

    console.log('\n4. Confirming an ID-JAG from an UNTRUSTED issuer is rejected ...');
    const untrustedJag = await new SignJWT({ client_id: TRUSTED_CLIENT_ID })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer('http://attacker.example')
      .setAudience(RESOURCE_AUDIENCE)
      .setSubject('user_123')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const badRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: untrustedJag,
      }),
    });
    console.log(`   status=${badRes.status} (expect 400)`, await badRes.json());
    if (badRes.status !== 400) throw new Error('Expected untrusted-issuer ID-JAG to be rejected');

    console.log('\nAll smoke tests passed.');
  } finally {
    mockIdp.close();
  }
}

main().catch((error) => {
  console.error('\nSmoke test FAILED:', error);
  process.exit(1);
});

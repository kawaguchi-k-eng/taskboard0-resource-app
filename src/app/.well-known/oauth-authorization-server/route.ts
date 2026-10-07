import { NextResponse } from 'next/server';

/**
 * RFC 8414 Authorization Server Metadata. A real EMA-aware MCP client (like
 * Claude) looks for the jwt-bearer grant type here to discover that this
 * server supports Enterprise Managed Auth; our own agent calls the token
 * endpoint directly, but this keeps the demo protocol-accurate.
 */
export async function GET() {
  const issuer = process.env.RESOURCE_AUDIENCE ?? 'http://localhost:3001';

  return NextResponse.json({
    issuer,
    token_endpoint: `${issuer}/oauth/token`,
    grant_types_supported: ['urn:ietf:params:oauth:grant-type:jwt-bearer'],
    token_endpoint_auth_methods_supported: ['none'],
  });
}

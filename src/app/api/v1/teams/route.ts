import { NextRequest, NextResponse } from 'next/server';
import { requireAccessToken } from '@/lib/require-access-token';
import { listTeams } from '@/lib/store';

export async function GET(req: NextRequest) {
  const auth = await requireAccessToken(req);
  if ('response' in auth) return auth.response;

  return NextResponse.json({ teams: listTeams() });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAccessToken } from '@/lib/require-access-token';
import { listWorkflowStates } from '@/lib/store';

export async function GET(req: NextRequest) {
  const auth = await requireAccessToken(req);
  if ('response' in auth) return auth.response;

  const teamKey = req.nextUrl.searchParams.get('team') ?? undefined;
  return NextResponse.json({ workflowStates: listWorkflowStates(teamKey) });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAccessToken } from '@/lib/require-access-token';
import { getIssue, updateIssueState } from '@/lib/store';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAccessToken(req);
  if ('response' in auth) return auth.response;

  const { id } = await params;
  const issue = getIssue(id);
  if (!issue) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ issue });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAccessToken(req);
  if ('response' in auth) return auth.response;

  const { id } = await params;
  const body = (await req.json()) as { stateId?: string };
  if (!body.stateId) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'stateId is required' },
      { status: 400 }
    );
  }

  try {
    const issue = updateIssueState(id, body.stateId);
    return NextResponse.json({ issue });
  } catch (error) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

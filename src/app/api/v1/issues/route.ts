import { NextRequest, NextResponse } from 'next/server';
import { requireAccessToken } from '@/lib/require-access-token';
import { createIssue, listIssues } from '@/lib/store';

export async function GET(req: NextRequest) {
  const auth = await requireAccessToken(req);
  if ('response' in auth) return auth.response;

  const teamKey = req.nextUrl.searchParams.get('team') ?? undefined;
  return NextResponse.json({ issues: listIssues(teamKey) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAccessToken(req);
  if ('response' in auth) return auth.response;

  const body = (await req.json()) as { teamId?: string; title?: string; description?: string };
  if (!body.teamId || !body.title) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'teamId and title are required' },
      { status: 400 }
    );
  }

  try {
    const issue = createIssue({ teamId: body.teamId, title: body.title, description: body.description });
    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

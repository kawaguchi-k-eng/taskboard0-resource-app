import { NextResponse } from 'next/server';
import { listIssues, listTeams, listWorkflowStates } from '@/lib/store';

/**
 * Unauthenticated read-only snapshot for the demo kanban board UI.
 * Deliberately separate from /api/v1/*, which is the real XAA-protected API
 * the agent calls — this just lets you *watch* the board update live.
 */
export async function GET() {
  return NextResponse.json({
    teams: listTeams(),
    workflowStates: listWorkflowStates(),
    issues: listIssues(),
  });
}

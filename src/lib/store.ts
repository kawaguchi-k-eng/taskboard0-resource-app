// In-memory demo data store. Resets on cold start — intentional for a demo
// resource app; swap for DynamoDB/Postgres before relying on this for
// anything beyond showing the Cross App Access flow end to end.
import { randomUUID } from 'crypto';

export type Team = { id: string; key: string; name: string };
export type WorkflowState = { id: string; name: string; teamId: string; order: number };
export type Issue = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  teamId: string;
  stateId: string;
  updatedAt: string;
};

const teams: Team[] = [{ id: 'team_eng', key: 'ENG', name: 'エンジニアリング' }];

const workflowStates: WorkflowState[] = [
  { id: 'state_todo', name: '未着手', teamId: 'team_eng', order: 0 },
  { id: 'state_in_progress', name: '進行中', teamId: 'team_eng', order: 1 },
  { id: 'state_done', name: '完了', teamId: 'team_eng', order: 2 },
];

let issueSequence = 2;
const issues: Issue[] = [
  {
    id: 'issue_1',
    identifier: 'ENG-1',
    title: 'Okta で Cross App Access を設定する',
    description: 'XAA リソースサーバーのトークンエンドポイントを実装する。',
    teamId: 'team_eng',
    stateId: 'state_in_progress',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'issue_2',
    identifier: 'ENG-2',
    title: 'カンバンボードの UI をデザインする',
    teamId: 'team_eng',
    stateId: 'state_todo',
    updatedAt: new Date().toISOString(),
  },
];

export function listTeams(): Team[] {
  return teams;
}

export function listWorkflowStates(teamKey?: string): WorkflowState[] {
  if (!teamKey) return workflowStates;
  const team = teams.find((t) => t.key === teamKey);
  if (!team) return [];
  return workflowStates.filter((s) => s.teamId === team.id);
}

export function listIssues(teamKey?: string): Issue[] {
  const filtered = teamKey
    ? issues.filter((i) => i.teamId === teams.find((t) => t.key === teamKey)?.id)
    : issues;
  return [...filtered].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getIssue(id: string): Issue | undefined {
  return issues.find((i) => i.id === id);
}

export function createIssue(input: { teamId: string; title: string; description?: string }): Issue {
  const team = teams.find((t) => t.id === input.teamId);
  if (!team) throw new Error(`Unknown teamId: ${input.teamId}`);

  issueSequence += 1;
  const issue: Issue = {
    id: randomUUID(),
    identifier: `${team.key}-${issueSequence}`,
    title: input.title,
    description: input.description,
    teamId: team.id,
    stateId: workflowStates.find((s) => s.teamId === team.id)?.id ?? '',
    updatedAt: new Date().toISOString(),
  };
  issues.push(issue);
  return issue;
}

export function updateIssueState(id: string, stateId: string): Issue {
  const issue = issues.find((i) => i.id === id);
  if (!issue) throw new Error(`Unknown issue id: ${id}`);
  if (!workflowStates.some((s) => s.id === stateId && s.teamId === issue.teamId)) {
    throw new Error(`State ${stateId} is not valid for team ${issue.teamId}`);
  }
  issue.stateId = stateId;
  issue.updatedAt = new Date().toISOString();
  return issue;
}

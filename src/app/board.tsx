'use client';

import { useEffect, useState } from 'react';

type Team = { id: string; key: string; name: string };
type WorkflowState = { id: string; name: string; teamId: string; order: number };
type Issue = { id: string; identifier: string; title: string; stateId: string; teamId: string };

type Snapshot = { teams: Team[]; workflowStates: WorkflowState[]; issues: Issue[] };

export default function Board() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/board-snapshot', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setSnapshot(data);
      } catch {
        // ignore transient fetch errors between polls
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!snapshot) return <p>Loading board…</p>;

  const states = [...snapshot.workflowStates].sort((a, b) => a.order - b.order);

  return (
    <div style={{ display: 'flex', gap: 16, width: '100%', overflowX: 'auto' }}>
      {states.map((state) => (
        <div
          key={state.id}
          style={{
            flex: '1 0 220px',
            minWidth: 220,
            border: '1px solid #4443',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <h3 style={{ marginBottom: 8, fontSize: 14, opacity: 0.7, textTransform: 'uppercase' }}>
            {state.name}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snapshot.issues
              .filter((issue) => issue.stateId === state.id)
              .map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    border: '1px solid #4443',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 14,
                  }}
                >
                  <div style={{ opacity: 0.6, fontSize: 12 }}>{issue.identifier}</div>
                  <div>{issue.title}</div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

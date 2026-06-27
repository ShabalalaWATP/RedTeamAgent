import type { ModelProfile } from '../../shared/types';
import { EmptyState } from '../../shared/ui';

type AgentAssignmentsPanelProps = {
  profiles: ModelProfile[];
};

export function AgentAssignmentsPanel({ profiles }: AgentAssignmentsPanelProps) {
  return (
    <section className="panel stack">
      <h2>Agent assignments</h2>
      {profiles.length === 0 ? (
        <EmptyState title="No profiles" body="Assign a model profile to an agent before running policy checks." />
      ) : (
        <div className="list">
          {profiles.map((profile) => (
            <article className="list-item" key={profile.id}>
              <div>
                <strong>{profile.name}</strong>
                <p className="muted">{profile.agent_key} · {profile.explicit_pin ? 'explicit pin' : 'fallback allowed'}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

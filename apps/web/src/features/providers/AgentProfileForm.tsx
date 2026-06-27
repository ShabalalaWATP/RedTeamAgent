import { AGENT_OPTIONS } from '../../shared/agentOptions';
import type { ModelRecord } from '../../shared/types';
import { Button, Field } from '../../shared/ui';

type AgentProfileFormProps = {
  models: ModelRecord[];
  profileName: string;
  profileAgent: string;
  profileModelId: string;
  explicitPin: boolean;
  onProfileNameChange: (value: string) => void;
  onProfileAgentChange: (value: string) => void;
  onProfileModelIdChange: (value: string) => void;
  onExplicitPinChange: (value: boolean) => void;
  onCreateProfile: () => void;
};

export function AgentProfileForm({
  models,
  profileName,
  profileAgent,
  profileModelId,
  explicitPin,
  onProfileNameChange,
  onProfileAgentChange,
  onProfileModelIdChange,
  onExplicitPinChange,
  onCreateProfile
}: AgentProfileFormProps) {
  return (
    <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
      <h2>Agent profile</h2>
      <Field label="Profile name">
        <input value={profileName} onChange={(event) => onProfileNameChange(event.target.value)} />
      </Field>
      <Field label="Agent">
        <select value={profileAgent} onChange={(event) => onProfileAgentChange(event.target.value)}>
          {AGENT_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </Field>
      <Field label="Model record">
        <select value={profileModelId} onChange={(event) => onProfileModelIdChange(event.target.value)}>
          <option value="">Select a model</option>
          {models.map((model) => <option key={model.id} value={model.id}>{model.model_identifier}</option>)}
        </select>
      </Field>
      <label className="check-row">
        <input type="checkbox" checked={explicitPin} onChange={(event) => onExplicitPinChange(event.target.checked)} />
        Explicitly pin this agent to the model
      </label>
      <Button type="button" variant="primary" onClick={onCreateProfile} disabled={!profileModelId}>
        Assign profile
      </Button>
    </form>
  );
}

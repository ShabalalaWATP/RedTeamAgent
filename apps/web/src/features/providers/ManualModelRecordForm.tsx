import type { ProviderConnection } from '../../shared/types';
import { Button, Field } from '../../shared/ui';
import { ModelDropdown } from './ModelDropdown';
import type { CatalogueModel } from './providerCatalogue';

type ManualModelRecordFormProps = {
  connections: ProviderConnection[];
  modelConnectionId: string;
  modelIdentifier: string;
  manualModelOptions: CatalogueModel[];
  capabilities: string;
  provenance: string;
  verified: boolean;
  onModelConnectionIdChange: (value: string) => void;
  onModelIdentifierChange: (value: string) => void;
  onCapabilitiesChange: (value: string) => void;
  onProvenanceChange: (value: string) => void;
  onVerifiedChange: (value: boolean) => void;
  onCreateModel: () => void;
};

export function ManualModelRecordForm({
  connections,
  modelConnectionId,
  modelIdentifier,
  manualModelOptions,
  capabilities,
  provenance,
  verified,
  onModelConnectionIdChange,
  onModelIdentifierChange,
  onCapabilitiesChange,
  onProvenanceChange,
  onVerifiedChange,
  onCreateModel
}: ManualModelRecordFormProps) {
  return (
    <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
      <h2>Manual model record</h2>
      <Field label="Provider connection">
        <select value={modelConnectionId} onChange={(event) => onModelConnectionIdChange(event.target.value)}>
          <option value="">Select a connection</option>
          {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
        </select>
      </Field>
      <Field label="Model" hint="Choose from the selected provider connection's discovered model list.">
        <ModelDropdown
          value={modelIdentifier}
          options={manualModelOptions}
          disabled={!modelConnectionId}
          onChange={onModelIdentifierChange}
        />
      </Field>
      <Field label="Capabilities" hint="Comma-separated provider-neutral capabilities.">
        <input value={capabilities} onChange={(event) => onCapabilitiesChange(event.target.value)} />
      </Field>
      <Field label="Provenance" hint="Where this model record came from, for example manual or provider catalogue.">
        <input value={provenance} onChange={(event) => onProvenanceChange(event.target.value)} />
      </Field>
      <label className="check-row">
        <input type="checkbox" checked={verified} onChange={(event) => onVerifiedChange(event.target.checked)} />
        Capability probe verified
      </label>
      <Button type="button" variant="primary" onClick={onCreateModel} disabled={!modelConnectionId}>
        Register model
      </Button>
    </form>
  );
}

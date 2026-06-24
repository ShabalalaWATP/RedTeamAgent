import { PlugZap, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { ModelProfile, ModelRecord, ProviderConnection } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';

type AdapterField = {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  input_type: string;
};

type AdapterSchema = {
  key: string;
  label: string;
  fields: AdapterField[];
  default_capabilities: string[];
};

const AGENT_OPTIONS = [
  ['evidence_context', 'Evidence and Context'],
  ['alternative_perspectives', 'Alternative Perspectives'],
  ['software_architecture', 'Software Architecture and Quality'],
  ['cybersecurity_privacy', 'Cybersecurity and Privacy'],
  ['legal_regulatory', 'Legal and Regulatory'],
  ['policy_governance', 'Policy and Governance'],
  ['product_user_experience', 'Product and User Experience'],
  ['operations_delivery', 'Operations and Delivery']
];

function splitCapabilities(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function ProviderSettings() {
  const { auth } = useAuth();
  const [schemas, setSchemas] = useState<AdapterSchema[]>([]);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [selected, setSelected] = useState('fake');
  const [name, setName] = useState('Fake local provider');
  const [values, setValues] = useState<Record<string, string>>({ scenario: 'valid' });
  const [modelConnectionId, setModelConnectionId] = useState('');
  const [modelIdentifier, setModelIdentifier] = useState('fake-reviewer');
  const [capabilities, setCapabilities] = useState('text, structured_output, streaming');
  const [provenance, setProvenance] = useState('manual');
  const [verified, setVerified] = useState(false);
  const [profileName, setProfileName] = useState('Default evidence profile');
  const [profileAgent, setProfileAgent] = useState('evidence_context');
  const [profileModelId, setProfileModelId] = useState('');
  const [explicitPin, setExplicitPin] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const loadWorkspaceData = async () => {
    if (!auth) return;
    const nextConnections = await api.listProviderConnections(auth.workspaceId);
    const nextModels = await api.listModels(auth.workspaceId);
    const nextProfiles = await api.listProfiles(auth.workspaceId);
    setConnections(nextConnections);
    setModels(nextModels);
    setProfiles(nextProfiles);
    setModelConnectionId((current) => current || nextConnections[0]?.id || '');
    setProfileModelId((current) => current || nextModels[0]?.id || '');
    setWorkspaceError(null);
  };

  useEffect(() => {
    api
      .adapterSchemas()
      .then((data) => setSchemas(data as AdapterSchema[]))
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    loadWorkspaceData().catch((err) => setWorkspaceError((err as Error).message));
  }, [auth?.workspaceId]);

  const schema = schemas.find((item) => item.key === selected);

  const createConnection = async () => {
    if (!auth || !schema) return;
    setError(null);
    const credentials = Object.fromEntries(
      schema.fields.filter((field) => field.secret).map((field) => [field.name, values[field.name] ?? ''])
    );
    const config = Object.fromEntries(
      schema.fields.filter((field) => !field.secret).map((field) => [field.name, values[field.name] ?? ''])
    );
    try {
      const connection = await api.createProviderConnection(auth.csrfToken, {
        workspace_id: auth.workspaceId,
        adapter: schema.key,
        name,
        config,
        credentials
      });
      setResult('Provider connection saved and tested. Credentials were not returned to the browser.');
      await loadWorkspaceData();
      setModelConnectionId(connection.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createModel = async () => {
    if (!auth || !modelConnectionId) return;
    setError(null);
    try {
      const model = await api.createModel(auth.csrfToken, {
        workspace_id: auth.workspaceId,
        provider_connection_id: modelConnectionId,
        model_identifier: modelIdentifier,
        capabilities: splitCapabilities(capabilities),
        provenance,
        verified
      });
      setResult('Model record saved with visible capability provenance.');
      await loadWorkspaceData();
      setProfileModelId(model.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createProfile = async () => {
    if (!auth || !profileModelId) return;
    setError(null);
    try {
      await api.createProfile(auth.csrfToken, {
        workspace_id: auth.workspaceId,
        name: profileName,
        agent_key: profileAgent,
        model_record_id: profileModelId,
        explicit_pin: explicitPin
      });
      setResult('Model profile assigned to agent.');
      await loadWorkspaceData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const testConnection = async (connectionId: string) => {
    if (!auth) return;
    setError(null);
    try {
      await api.testProviderConnection(auth.csrfToken, connectionId);
      setResult('Stored connection test passed.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const syncCatalogue = async (connectionId: string) => {
    if (!auth) return;
    setError(null);
    try {
      const synced = await api.syncModels(auth.csrfToken, connectionId);
      setResult(`Model catalogue synced with ${synced.length} record${synced.length === 1 ? '' : 's'}.`);
      await loadWorkspaceData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const probeModel = async (modelId: string) => {
    if (!auth) return;
    setError(null);
    try {
      const model = await api.probeModel(auth.csrfToken, modelId);
      setResult(`Capability probe ${model.verified ? 'passed' : 'needs review'} for ${model.model_identifier}.`);
      await loadWorkspaceData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>Provider settings</h1>
          <p className="muted">Manage provider connections, model capabilities and agent model profiles.</p>
        </div>
        <Status tone="warn">Credentials write-only</Status>
      </div>
      <ErrorState message={error || workspaceError} />
      <div className="grid">
        <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
          <h2>Provider connection</h2>
          {schemas.length === 0 ? (
            <EmptyState title="No adapters" body="No provider adapters are available in this environment." />
          ) : null}
          <Field label="Adapter">
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {schemas.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Connection name">
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          {schema?.fields.map((field) => (
            <Field key={field.name} label={field.label} hint={field.secret ? 'Stored server-side only.' : undefined}>
              <input
                type={field.secret ? 'password' : field.input_type}
                value={values[field.name] ?? ''}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                required={field.required}
              />
            </Field>
          ))}
          <Button type="button" variant="primary" onClick={createConnection} disabled={!schema}>
            <PlugZap size={16} /> Test and save
          </Button>
        </form>
        <aside className="panel stack">
          <h2>Saved connections</h2>
          {connections.length === 0 ? (
            <EmptyState title="No connections" body="Save a provider connection before registering models." />
          ) : (
            <div className="list">
              {connections.map((connection) => (
                <article className="list-item" key={connection.id}>
                  <div>
                    <strong>{connection.name}</strong>
                    <p className="muted">{connection.adapter} · credentials {connection.has_credentials ? 'stored' : 'not required'}</p>
                  </div>
                  <div className="row">
                    <Button type="button" onClick={() => void testConnection(connection.id)}>
                      <RefreshCcw size={16} /> Test
                    </Button>
                    <Button type="button" onClick={() => void syncCatalogue(connection.id)}>
                      Sync catalogue
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="muted">{result || 'Capability provenance appears after a model record is saved.'}</p>
        </aside>
      </div>
      <div className="grid">
        <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
          <h2>Manual model record</h2>
          <Field label="Provider connection">
            <select value={modelConnectionId} onChange={(event) => setModelConnectionId(event.target.value)}>
              <option value="">Select a connection</option>
              {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
            </select>
          </Field>
          <Field label="Model identifier">
            <input value={modelIdentifier} onChange={(event) => setModelIdentifier(event.target.value)} />
          </Field>
          <Field label="Capabilities" hint="Comma-separated provider-neutral capabilities.">
            <input value={capabilities} onChange={(event) => setCapabilities(event.target.value)} />
          </Field>
          <Field label="Provenance">
            <input value={provenance} onChange={(event) => setProvenance(event.target.value)} />
          </Field>
          <label className="check-row">
            <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
            Capability probe verified
          </label>
          <Button type="button" variant="primary" onClick={createModel} disabled={!modelConnectionId}>
            Register model
          </Button>
        </form>
        <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
          <h2>Agent profile</h2>
          <Field label="Profile name">
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
          </Field>
          <Field label="Agent">
            <select value={profileAgent} onChange={(event) => setProfileAgent(event.target.value)}>
              {AGENT_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <Field label="Model record">
            <select value={profileModelId} onChange={(event) => setProfileModelId(event.target.value)}>
              <option value="">Select a model</option>
              {models.map((model) => <option key={model.id} value={model.id}>{model.model_identifier}</option>)}
            </select>
          </Field>
          <label className="check-row">
            <input type="checkbox" checked={explicitPin} onChange={(event) => setExplicitPin(event.target.checked)} />
            Explicitly pin this agent to the model
          </label>
          <Button type="button" variant="primary" onClick={createProfile} disabled={!profileModelId}>
            Assign profile
          </Button>
        </form>
      </div>
      <div className="grid">
        <section className="panel stack">
          <h2>Model catalogue</h2>
          {models.length === 0 ? (
            <EmptyState title="No model records" body="Register a model to make capability provenance visible." />
          ) : (
            <div className="list">
              {models.map((model) => (
                <article className="list-item" key={model.id}>
                  <div>
                    <strong>{model.model_identifier}</strong>
                    <p className="muted">{model.provenance} · {model.verified ? 'verified' : 'unverified'}</p>
                    <p className="muted">{model.capabilities.join(', ') || 'No capabilities recorded.'}</p>
                    <small>{String(model.probe_result.source ?? 'No probe recorded')}</small>
                  </div>
                  <Button type="button" onClick={() => void probeModel(model.id)}>Probe</Button>
                </article>
              ))}
            </div>
          )}
        </section>
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
      </div>
    </section>
  );
}

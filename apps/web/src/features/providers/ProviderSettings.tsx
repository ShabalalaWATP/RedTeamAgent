import { PlugZap, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { AGENT_OPTIONS } from '../../shared/agentOptions';
import type { ModelProfile, ModelRecord, ProviderConnection } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field } from '../../shared/ui';
import { EvaluationPanel } from './EvaluationPanel';
import { ModelDropdown } from './ModelDropdown';
import { adapterFieldHint, capabilitiesForModel, modelOptionKey, modelOptionsForConnection, modelOptionsForSchema, preferredModelIdentifier, schemaForConnection, type AdapterSchema } from './providerCatalogue';
import './providers.css';

function splitCapabilities(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

type ProviderSettingsProps = {
  embedded?: boolean;
};

export function ProviderSettings({ embedded = false }: ProviderSettingsProps) {
  const { auth } = useAuth();
  const [schemas, setSchemas] = useState<AdapterSchema[]>([]);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [selected, setSelected] = useState('fake');
  const [defaultModelIdentifier, setDefaultModelIdentifier] = useState('fake-reviewer');
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
  const defaultModelOptions = modelOptionsForSchema(schema);
  const modelConnection = connections.find((connection) => connection.id === modelConnectionId);
  const manualModelSchema = schemaForConnection(schemas, modelConnection);
  const manualModelOptions = modelOptionsForConnection(schemas, models, modelConnection);
  const defaultModelOptionKey = modelOptionKey(defaultModelOptions);
  const manualModelOptionKey = modelOptionKey(manualModelOptions);

  useEffect(() => {
    if (defaultModelOptions.length === 0) return;
    setDefaultModelIdentifier((current) => preferredModelIdentifier(defaultModelOptions, current));
  }, [defaultModelOptionKey]);

  useEffect(() => {
    if (manualModelOptions.length === 0) return;
    const nextIdentifier = preferredModelIdentifier(manualModelOptions, modelIdentifier);
    setModelIdentifier(nextIdentifier);
    setCapabilities(capabilitiesForModel(
      manualModelOptions,
      nextIdentifier,
      manualModelSchema?.default_capabilities ?? []
    ).join(', '));
  }, [manualModelOptionKey, manualModelSchema?.key]);

  const createConnection = async () => {
    if (!auth || !schema) return;
    setError(null);
    const credentials = Object.fromEntries(
      schema.fields.filter((field) => field.secret).map((field) => [field.name, values[field.name] ?? ''])
    );
    const config = Object.fromEntries(
      schema.fields.filter((field) => !field.secret).map((field) => [field.name, values[field.name] ?? ''])
    );
    if (defaultModelOptions.some((model) => model.model_identifier === defaultModelIdentifier)) {
      config.model_identifier = defaultModelIdentifier;
    }
    try {
      const connection = await api.createProviderConnection(auth.csrfToken, {
        workspace_id: auth.workspaceId,
        adapter: schema.key,
        name,
        config,
        credentials
      });
      const synced = await api.syncModels(auth.csrfToken, connection.id);
      setResult(`Provider connection saved. ${synced.length} model${synced.length === 1 ? '' : 's'} available.`);
      await loadWorkspaceData();
      setModelConnectionId(connection.id);
      setProfileModelId(synced[0]?.id ?? '');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createModel = async () => {
    /* v8 ignore next -- defensive guard; the register button is disabled until a connection is selected. */
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
    /* v8 ignore next -- defensive guard; the assign button is disabled until a model is selected. */
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
    /* v8 ignore next -- saved connection actions are unavailable until authenticated workspace data loads. */
    if (!auth) return;
    setError(null);
    try {
      await api.testProviderConnection(auth.csrfToken, connectionId);
      setResult('Stored connection test passed.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const refreshModels = async (connectionId: string) => {
    /* v8 ignore next -- saved connection actions are unavailable until authenticated workspace data loads. */
    if (!auth) return;
    setError(null);
    try {
      const synced = await api.syncModels(auth.csrfToken, connectionId);
      setResult(`Model list refreshed with ${synced.length} model${synced.length === 1 ? '' : 's'}.`);
      await loadWorkspaceData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const probeModel = async (modelId: string) => {
    /* v8 ignore next -- model actions are unavailable until authenticated workspace data loads. */
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
    <section className={embedded ? 'settings-block stack' : 'screen'}>
      <div className="screen-header">
        <div>
          {embedded ? <h2>AI setup</h2> : <h1>AI setup</h1>}
          <p className="muted">Choose the provider and model RedTeamAgent should use.</p>
        </div>
      </div>
      <ErrorState message={error || workspaceError} />
      <div className="grid provider-primary-grid">
        <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
          <h2>Connect an AI provider</h2>
          {schemas.length === 0 ? (
            <EmptyState title="No adapters" body="No provider adapters are available in this environment." />
          ) : null}
          <Field label="AI provider" hint="This controls where RedTeamAgent sends AI review requests.">
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {schemas.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Model" hint="Available models reported by the selected provider.">
            <ModelDropdown
              value={defaultModelIdentifier}
              options={defaultModelOptions}
              onChange={setDefaultModelIdentifier}
            />
          </Field>
          <Field
            label="Display name"
            hint="An internal label, for example 'OpenAI production'. This is not a URL."
          >
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          {schema?.fields.map((field) => (
            <Field key={field.name} label={field.label} hint={adapterFieldHint(field)}>
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
            <EmptyState title="No saved provider" body="Save the provider RedTeamAgent should use for reviews." />
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
                    <Button type="button" onClick={() => void refreshModels(connection.id)}>
                      Refresh models
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="muted">{result || 'Saved providers can be tested or refreshed here.'}</p>
        </aside>
      </div>
      <details className="settings-disclosure">
        <summary>
          <span>Advanced AI controls</span>
          <small>Optional model records, agent pins, capability probes and evaluation checks.</small>
        </summary>
        <div className="grid">
          <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
            <h2>Manual model record</h2>
            <Field label="Provider connection">
              <select value={modelConnectionId} onChange={(event) => setModelConnectionId(event.target.value)}>
                <option value="">Select a connection</option>
                {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
              </select>
            </Field>
            <Field label="Model" hint="Choose from the selected provider connection's discovered model list.">
              <ModelDropdown
                value={modelIdentifier}
                options={manualModelOptions}
                disabled={!modelConnectionId}
                onChange={(next) => {
                  setModelIdentifier(next);
                  setCapabilities(capabilitiesForModel(
                    manualModelOptions,
                    next,
                    manualModelSchema?.default_capabilities ?? []
                  ).join(', '));
                }}
              />
            </Field>
            <Field label="Capabilities" hint="Comma-separated provider-neutral capabilities.">
              <input value={capabilities} onChange={(event) => setCapabilities(event.target.value)} />
            </Field>
            <Field label="Provenance" hint="Where this model record came from, for example manual or provider catalogue.">
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
            <Field label="Profile name"><input value={profileName} onChange={(event) => setProfileName(event.target.value)} /></Field>
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
            <Button type="button" variant="primary" onClick={createProfile} disabled={!profileModelId}>Assign profile</Button>
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
        <EvaluationPanel />
      </details>
    </section>
  );
}

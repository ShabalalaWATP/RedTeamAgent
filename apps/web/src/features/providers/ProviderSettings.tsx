import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { ModelProfile, ModelRecord, ProviderConnection } from '../../shared/types';
import { ErrorState } from '../../shared/ui';
import { AgentAssignmentsPanel } from './AgentAssignmentsPanel';
import { AgentProfileForm } from './AgentProfileForm';
import { EvaluationPanel } from './EvaluationPanel';
import { ManualModelRecordForm } from './ManualModelRecordForm';
import { ModelCataloguePanel } from './ModelCataloguePanel';
import { ProviderConnectionForm } from './ProviderConnectionForm';
import { SavedConnectionsPanel } from './SavedConnectionsPanel';
import { providerConfig, providerCredentials } from './providerFormData';
import {
  capabilitiesForModel,
  modelOptionKey,
  modelOptionsForConnection,
  modelOptionsForSetup,
  preferredModelIdentifier,
  schemaForConnection,
  type AdapterSchema,
  type CatalogueModel
} from './providerCatalogue';
import {
  activeReviewModelId,
  modelCountLabel,
  selectionResult,
  selectSyncedModel,
  visibleProviderConnections,
  visibleProviderModels,
  visibleProviderSchemas
} from './providerSelection';
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
  const [selected, setSelected] = useState('openai');
  const [defaultModelIdentifier, setDefaultModelIdentifier] = useState('');
  const [liveModelOptions, setLiveModelOptions] = useState<CatalogueModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [name, setName] = useState('Production AI provider');
  const [values, setValues] = useState<Record<string, string>>({ scenario: 'valid' });
  const [modelConnectionId, setModelConnectionId] = useState('');
  const [modelIdentifier, setModelIdentifier] = useState('');
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
    const selectableConnections = visibleProviderConnections(nextConnections);
    const selectableModels = visibleProviderModels(nextModels, selectableConnections);
    setConnections(nextConnections);
    setModels(nextModels);
    setProfiles(nextProfiles);
    setModelConnectionId((current) => (
      selectableConnections.some((connection) => connection.id === current)
        ? current
        : selectableConnections[0]?.id || ''
    ));
    setProfileModelId((current) => (
      selectableModels.some((model) => model.id === current) ? current : selectableModels[0]?.id || ''
    ));
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
  const visibleSchemas = visibleProviderSchemas(schemas);
  const visibleConnections = visibleProviderConnections(connections);
  const visibleModels = visibleProviderModels(models, visibleConnections);
  const activeModelId = activeReviewModelId(profiles);
  const schema = visibleSchemas.find((item) => item.key === selected);
  const defaultModelOptions = modelOptionsForSetup(schema, liveModelOptions);
  const modelConnection = visibleConnections.find((connection) => connection.id === modelConnectionId);
  const manualModelSchema = schemaForConnection(schemas, modelConnection);
  const manualModelOptions = modelOptionsForConnection(schemas, visibleModels, modelConnection);
  const defaultModelOptionKey = modelOptionKey(defaultModelOptions);
  const manualModelOptionKey = modelOptionKey(manualModelOptions);

  useEffect(() => {
    setDefaultModelIdentifier((current) => (
      defaultModelOptions.length ? preferredModelIdentifier(defaultModelOptions, current) : ''
    ));
  }, [defaultModelOptionKey]);

  useEffect(() => {
    if (schema || visibleSchemas.length === 0) return;
    setSelected(visibleSchemas[0].key);
  }, [schema?.key, visibleSchemas.map((item) => item.key).join('|')]);
  useEffect(() => { setLiveModelOptions([]); }, [selected]);
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
    const credentials = providerCredentials(schema, values);
    const config = providerConfig(schema, values, defaultModelIdentifier, liveModelOptions.length > 0);
    try {
      const connection = await api.createProviderConnection(auth.csrfToken, {
        workspace_id: auth.workspaceId,
        adapter: schema.key,
        name,
        config,
        credentials
      });
      const synced = await api.syncModels(auth.csrfToken, connection.id);
      const model = selectSyncedModel(synced, defaultModelIdentifier);
      const probed = model ? await api.probeModel(auth.csrfToken, model.id) : null;
      if (probed?.verified) await api.selectModel(auth.csrfToken, probed.id);
      setResult(selectionResult(connection.name, synced, probed));
      await loadWorkspaceData();
      setModelConnectionId(connection.id);
      setProfileModelId(probed?.id ?? synced[0]?.id ?? '');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadProviderModels = async () => {
    if (!auth || !schema) return;
    setError(null);
    setLoadingModels(true);
    try {
      const models = await api.previewProviderModels(auth.csrfToken, {
        workspace_id: auth.workspaceId,
        adapter: schema.key,
        config: providerConfig(schema, values),
        credentials: providerCredentials(schema, values)
      });
      setLiveModelOptions(models);
      setDefaultModelIdentifier(preferredModelIdentifier(models, defaultModelIdentifier));
      setResult(`Loaded ${modelCountLabel(models.length)} from ${schema.label}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingModels(false);
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
      const connection = connections.find((item) => item.id === connectionId);
      const model = selectSyncedModel(synced, modelIdentifier);
      const probed = model ? await api.probeModel(auth.csrfToken, model.id) : null;
      if (probed?.verified) await api.selectModel(auth.csrfToken, probed.id);
      setResult(selectionResult(connection?.name ?? 'Provider', synced, probed));
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

  const updateManualModelIdentifier = (next: string) => {
    setModelIdentifier(next);
    setCapabilities(capabilitiesForModel(
      manualModelOptions,
      next,
      manualModelSchema?.default_capabilities ?? []
    ).join(', '));
  };

  return (
    <section className={embedded ? 'settings-block stack' : 'screen'}>
      <div className="screen-header">
        <div>
          {embedded ? <h2>AI setup</h2> : <h1>AI setup</h1>}
          <p className="muted">Choose the provider and model TheAllSeeingEye should use.</p>
        </div>
      </div>
      <ErrorState message={error || workspaceError} />
      <div className="grid provider-primary-grid">
        <ProviderConnectionForm
          schemas={schemas}
          visibleSchemas={visibleSchemas}
          schema={schema}
          selected={selected}
          name={name}
          values={values}
          defaultModelIdentifier={defaultModelIdentifier}
          defaultModelOptions={defaultModelOptions}
          loadingModels={loadingModels}
          onSelectedChange={setSelected}
          onNameChange={setName}
          onValuesChange={setValues}
          onDefaultModelIdentifierChange={setDefaultModelIdentifier}
          onLoadProviderModels={() => void loadProviderModels()}
          onCreateConnection={() => void createConnection()}
        />
        <SavedConnectionsPanel
          connections={visibleConnections}
          models={visibleModels}
          activeModelId={activeModelId}
          result={result}
          onTest={(connectionId) => void testConnection(connectionId)}
          onRefresh={(connectionId) => void refreshModels(connectionId)}
        />
      </div>
      <details className="settings-disclosure">
        <summary>
          <span>Advanced AI controls</span>
          <small>Optional model records, agent pins, capability probes and evaluation checks.</small>
        </summary>
        <div className="grid">
          <ManualModelRecordForm
            connections={visibleConnections}
            modelConnectionId={modelConnectionId}
            modelIdentifier={modelIdentifier}
            manualModelOptions={manualModelOptions}
            capabilities={capabilities}
            provenance={provenance}
            verified={verified}
            onModelConnectionIdChange={setModelConnectionId}
            onModelIdentifierChange={updateManualModelIdentifier}
            onCapabilitiesChange={setCapabilities}
            onProvenanceChange={setProvenance}
            onVerifiedChange={setVerified}
            onCreateModel={() => void createModel()}
          />
          <AgentProfileForm
            models={visibleModels}
            profileName={profileName}
            profileAgent={profileAgent}
            profileModelId={profileModelId}
            explicitPin={explicitPin}
            onProfileNameChange={setProfileName}
            onProfileAgentChange={setProfileAgent}
            onProfileModelIdChange={setProfileModelId}
            onExplicitPinChange={setExplicitPin}
            onCreateProfile={() => void createProfile()}
          />
        </div>
        <div className="grid">
          <ModelCataloguePanel models={visibleModels} onProbeModel={(modelId) => void probeModel(modelId)} />
          <AgentAssignmentsPanel profiles={profiles} />
        </div>
        <EvaluationPanel />
      </details>
    </section>
  );
}

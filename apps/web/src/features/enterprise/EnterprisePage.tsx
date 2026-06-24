import {
  Bell,
  Braces,
  CalendarClock,
  KeyRound,
  LockKeyhole,
  Network,
  Save,
  Send,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type {
  EnterpriseAuditEvent,
  EnterpriseMember,
  EnterpriseNotification,
  EnterpriseOperations,
  Governance,
  ModelComparison
} from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';
import './enterprise.css';

const emptyGovernance: Governance = {
  workspace_id: '',
  provider_allowlist: [],
  model_allowlist: [],
  data_classification_allowlist: [],
  region_allowlist: [],
  purpose_allowlist: [],
  approved_domains: [],
  retention_days: 365,
  preserve_historical_reports: true,
  legal_hold: false,
  mfa_required: false,
  sso_provider: null,
  custom_branding: {},
  updated_at: ''
};

const emptyOperations: EnterpriseOperations = {
  run_volume: 0,
  failure_rate: 0,
  security_events: 0,
  queue_depth: 0,
  tracing_redaction: 'enabled',
  quotas: {},
  backup_restore: {}
};

const emptyComparison: ModelComparison = {
  workspace_id: '',
  models: []
};

function csv(values: string[]) {
  return values.join(', ');
}

function split(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

type EnterprisePageProps = {
  embedded?: boolean;
};

export function EnterprisePage({ embedded = false }: EnterprisePageProps) {
  const { auth } = useAuth();
  const [governance, setGovernance] = useState<Governance>(emptyGovernance);
  const [members, setMembers] = useState<EnterpriseMember[]>([]);
  const [audit, setAudit] = useState<EnterpriseAuditEvent[]>([]);
  const [notifications, setNotifications] = useState<EnterpriseNotification[]>([]);
  const [operations, setOperations] = useState<EnterpriseOperations>(emptyOperations);
  const [comparison, setComparison] = useState<ModelComparison>(emptyComparison);
  const [providerList, setProviderList] = useState('');
  const [modelList, setModelList] = useState('');
  const [domainList, setDomainList] = useState('');
  const [inviteEmail, setInviteEmail] = useState('new.member@example.com');
  const [inviteRole, setInviteRole] = useState('member');
  const [agentName, setAgentName] = useState('Board challenge reviewer');
  const [agentInstructions, setAgentInstructions] = useState('Review the supplied evidence and return structured risks.');
  const [tokenName, setTokenName] = useState('Reporting automation');
  const [webhookUrl, setWebhookUrl] = useState('https://hooks.example/redteam');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    /* v8 ignore next -- Layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    const [nextGovernance, nextMembers, nextAudit, nextNotifications, nextOperations, nextComparison] =
      await Promise.all([
        api.enterpriseGovernance(auth.workspaceId),
        api.enterpriseMembers(auth.workspaceId),
        api.enterpriseAudit(auth.workspaceId),
        api.enterpriseNotifications(auth.workspaceId),
        api.enterpriseOperations(auth.workspaceId),
        api.modelComparison(auth.workspaceId)
      ]);
    setGovernance(nextGovernance);
    setProviderList(csv(nextGovernance.provider_allowlist));
    setModelList(csv(nextGovernance.model_allowlist));
    setDomainList(csv(nextGovernance.approved_domains));
    setMembers(nextMembers);
    setAudit(nextAudit);
    setNotifications(nextNotifications);
    setOperations(nextOperations);
    setComparison(nextComparison);
    setError(null);
  };

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [auth?.workspaceId]);

  const saveGovernance = async () => {
    /* v8 ignore next -- Layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    try {
      const saved = await api.updateEnterpriseGovernance(auth.csrfToken, auth.workspaceId, {
        ...governance,
        provider_allowlist: split(providerList),
        model_allowlist: split(modelList),
        approved_domains: split(domainList)
      });
      setGovernance(saved);
      setMessage('Governance policy saved.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const invite = async () => {
    /* v8 ignore next -- Layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    try {
      await api.inviteEnterpriseMember(auth.csrfToken, auth.workspaceId, inviteEmail, inviteRole);
      setMessage(`Invitation created for ${inviteEmail}.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createAgent = async () => {
    /* v8 ignore next -- Layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    try {
      await api.createCustomAgent(auth.csrfToken, auth.workspaceId, {
        name: agentName,
        instructions: agentInstructions,
        tool_permissions: ['read_sources'],
        output_schema: { type: 'object' },
        enabled: true
      });
      setMessage('Custom agent submitted for governed use.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createToken = async () => {
    /* v8 ignore next -- Layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    try {
      const token = await api.createApiToken(auth.csrfToken, auth.workspaceId, {
        name: tokenName,
        scopes: ['reviews:read'],
        rate_limit_per_minute: 60
      });
      setMessage(`Token ${token.token_prefix} created. Plain token shown once by the API.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createWebhook = async () => {
    /* v8 ignore next -- Layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    try {
      const webhook = await api.createWebhook(auth.csrfToken, auth.workspaceId, {
        name: 'Operations webhook',
        url: webhookUrl,
        events: ['run.completed', 'run.failed'],
        enabled: true
      });
      setMessage(`Webhook ${webhook.name} created.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const runRetention = async () => {
    /* v8 ignore next -- Layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    try {
      const result = await api.enforceRetention(auth.csrfToken, auth.workspaceId);
      setMessage(`Retention removed ${String(result.removed_notifications)} notification records.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className={embedded ? 'enterprise-screen settings-block stack' : 'screen enterprise-screen'}>
      <div className="screen-header">
        <div>
          {embedded ? <h2>Workspace administration</h2> : <h1>Workspace administration</h1>}
          <p className="muted">Workspace governance, collaboration controls and production operations.</p>
        </div>
        <Status tone={governance.mfa_required ? 'ok' : 'warn'}>{governance.mfa_required ? 'MFA required' : 'MFA optional'}</Status>
      </div>
      <ErrorState message={error} />
      {message ? <div className="enterprise-banner" role="status">{message}</div> : null}
      <div className="enterprise-grid">
        <section className="panel stack enterprise-wide" aria-labelledby="org-settings">
          <h2 id="org-settings"><ShieldCheck size={20} />Organisation settings</h2>
          <div className="enterprise-form-grid">
            <Field label="SSO provider">
              <input
                value={governance.sso_provider ?? ''}
                onChange={(event) => setGovernance({ ...governance, sso_provider: event.target.value })}
              />
            </Field>
            <Field label="Retention days">
              <input
                min={1}
                type="number"
                value={governance.retention_days}
                onChange={(event) => setGovernance({ ...governance, retention_days: Number(event.target.value) })}
              />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={governance.mfa_required}
                onChange={(event) => setGovernance({ ...governance, mfa_required: event.target.checked })}
              />
              MFA required
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={governance.legal_hold}
                onChange={(event) => setGovernance({ ...governance, legal_hold: event.target.checked })}
              />
              Legal hold
            </label>
          </div>
          <Button type="button" variant="primary" onClick={saveGovernance}><Save size={16} />Save governance</Button>
        </section>

        <section className="panel stack" aria-labelledby="members">
          <h2 id="members"><UsersRound size={20} />Member management</h2>
          <div className="enterprise-form-grid compact">
            <Field label="Invite email"><input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></Field>
            <Field label="Role">
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                <option value="administrator">Administrator</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </Field>
          </div>
          <Button type="button" onClick={invite}><Send size={16} />Invite</Button>
          <EntityList items={members.map((member) => `${member.email} · ${member.role}`)} empty="No members found." />
        </section>

        <section className="panel stack" aria-labelledby="governance">
          <h2 id="governance"><LockKeyhole size={20} />Provider governance</h2>
          <Field label="Provider allow-list"><textarea value={providerList} onChange={(event) => setProviderList(event.target.value)} /></Field>
          <Field label="Model allow-list"><textarea value={modelList} onChange={(event) => setModelList(event.target.value)} /></Field>
          <Field label="Approved research domains"><textarea value={domainList} onChange={(event) => setDomainList(event.target.value)} /></Field>
        </section>

        <section className="panel stack" aria-labelledby="actions">
          <h2 id="actions"><Bell size={20} />Action tracking</h2>
          <EntityList items={notifications.map((item) => `${item.kind}: ${item.title}`)} empty="No workspace notifications." />
        </section>

        <section className="panel stack" aria-labelledby="customisation">
          <h2 id="customisation"><Braces size={20} />Customisation</h2>
          <Field label="Custom agent name"><input value={agentName} onChange={(event) => setAgentName(event.target.value)} /></Field>
          <Field label="Custom agent instructions">
            <textarea value={agentInstructions} onChange={(event) => setAgentInstructions(event.target.value)} />
          </Field>
          <Button type="button" onClick={createAgent}>Create agent</Button>
        </section>

        <section className="panel stack" aria-labelledby="integrations">
          <h2 id="integrations"><KeyRound size={20} />API and webhooks</h2>
          <Field label="API token name"><input value={tokenName} onChange={(event) => setTokenName(event.target.value)} /></Field>
          <Button type="button" onClick={createToken}>Create token</Button>
          <Field label="Webhook URL"><input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} /></Field>
          <Button type="button" onClick={createWebhook}>Create webhook</Button>
        </section>

        <section className="panel stack" aria-labelledby="audit">
          <h2 id="audit"><Network size={20} />Audit inspector</h2>
          <EntityList items={audit.slice(0, 5).map((item) => item.action)} empty="No audit events." />
        </section>

        <section className="panel stack" aria-labelledby="operations">
          <h2 id="operations"><CalendarClock size={20} />Operations</h2>
          <div className="enterprise-metrics">
            <Metric label="Runs" value={String(operations.run_volume)} />
            <Metric label="Failure rate" value={`${Math.round(operations.failure_rate * 100)}%`} />
            <Metric label="Queue depth" value={String(operations.queue_depth)} />
          </div>
          <Button type="button" onClick={runRetention}>Run retention</Button>
        </section>

        <section className="panel stack enterprise-wide" aria-labelledby="comparison">
          <h2 id="comparison">Model comparison</h2>
          {comparison.models.length > 0 ? (
            <ul className="enterprise-table" aria-label="Model comparison">
              {comparison.models.map((model) => (
                <li key={model.model_identifier}>
                  <span>{model.model_identifier}</span>
                  <span>Quality {Math.round(model.quality * 100)}%</span>
                  <span>{model.latency_ms} ms</span>
                  <span>{model.capability_coverage} capabilities</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No model data" body="No governed model records are available." />}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-tile"><span className="muted">{label}</span><strong>{value}</strong></div>;
}

function EntityList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyState title="Empty" body={empty} />;
  return <ul className="enterprise-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>;
}

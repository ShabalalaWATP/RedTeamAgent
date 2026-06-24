import { BookOpen, Play, ShieldQuestion } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { AGENT_OPTIONS } from '../../shared/agentOptions';
import type { ContextPack, Review, Source, UsageLimits } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';
import { SourceIntakePanel } from './SourceIntakePanel';
import { Stage2ReviewSettings } from './Stage2ReviewSettings';

const DEFAULT_PROPOSAL = 'Adopt the proposal with staged validation, named owners, evidence checks and rollback criteria.';
const DEFAULT_CONTEXT = '# Governance\nUse source-linked claims and show assumptions.';

export function NewReviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [title, setTitle] = useState('Decision readiness review');
  const [proposal, setProposal] = useState(DEFAULT_PROPOSAL);
  const [mode, setMode] = useState<'basic' | 'standard' | 'in_depth'>('standard');
  const [focus, setFocus] = useState('security, policy, UX');
  const [externalResearch, setExternalResearch] = useState(false);
  const [privateResearch, setPrivateResearch] = useState(true);
  const [allowlist, setAllowlist] = useState('');
  const [blocklist, setBlocklist] = useState('localhost, 127.0.0.1, 169.254.169.254');
  const [review, setReview] = useState<Review | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [contextPacks, setContextPacks] = useState<ContextPack[]>([]);
  const [contextName, setContextName] = useState('Stage 1 governance context');
  const [contextAgent, setContextAgent] = useState('policy_governance');
  const [contextMarkdown, setContextMarkdown] = useState(DEFAULT_CONTEXT);
  const [contextMessage, setContextMessage] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<UsageLimits | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const refreshUsage = async () => {
    try {
      setUsage(await api.usageLimits());
    } catch {
      setUsage(null);
    }
  };

  useEffect(() => {
    if (!auth) return;
    let ignore = false;
    setContextError(null);
    api.listContextPacks(auth.workspaceId)
      .then((packs) => {
        if (!ignore) setContextPacks(packs);
      })
      .catch((err) => {
        if (!ignore) setContextError((err as Error).message);
      });
    refreshUsage();
    return () => {
      ignore = true;
    };
  }, [auth]);

  const createReviewDraft = async () => {
    if (!auth || !projectId) throw new Error('Project or session is missing.');
    const next = await api.createReview(auth.csrfToken, projectId, {
      title,
      proposal_text: proposal,
      mode,
      focus_chips: toList(focus),
      external_research: externalResearch,
      private_research: privateResearch,
      domain_allowlist: toList(allowlist),
      domain_blocklist: toList(blocklist)
    });
    setReview(next);
    return next;
  };

  const createReview = async () => {
    setError(null);
    try {
      await createReviewDraft();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addText = async () => {
    /* v8 ignore next -- the add-text button is disabled until a review exists. */
    if (!auth || !review) return;
    await addSource(() => api.addTextSource(auth.csrfToken, review.id, proposal));
  };

  const upload = async (file: File) => {
    /* v8 ignore next -- uploads are ignored until a review and file are present. */
    if (!auth || !review) return;
    await addSource(() => api.uploadSource(auth.csrfToken, review.id, file));
  };

  const addWebsite = async (url: string) => {
    await addSource(() => api.addWebsiteSource(auth!.csrfToken, review!.id, url.trim()));
  };

  const addRepository = async (url: string) => {
    await addSource(() => api.addRepositorySource(auth!.csrfToken, review!.id, url.trim()));
  };

  const addSource = async (operation: () => Promise<Source>) => {
    setSourceError(null);
    try {
      const source = await operation();
      setSources((current) => [source, ...current]);
    } catch (err) {
      setSourceError((err as Error).message);
    }
  };

  const addContextPack = async () => {
    if (!auth) return;
    setContextError(null);
    setContextMessage(null);
    try {
      const pack = await api.createContextPack(auth.csrfToken, {
        workspace_id: auth.workspaceId,
        name: contextName.trim(),
        agent_key: contextAgent,
        markdown: contextMarkdown.trim()
      });
      setContextPacks((current) => [pack, ...current.filter((item) => item.id !== pack.id)]);
      setContextMessage(`Saved ${pack.name} for ${pack.agent_key} as version ${pack.version}.`);
    } catch (err) {
      setContextError((err as Error).message);
    }
  };

  const runPreflight = async () => {
    /* v8 ignore next -- the preflight button is disabled until a review exists. */
    if (!review) return;
    setPreflight(await api.preflight(review.id));
  };

  const startRun = async () => {
    /* v8 ignore next -- the app layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    setError(null);
    setSourceError(null);
    setStarting(true);
    try {
      const currentReview = review ?? await createReviewDraft();
      if (sources.length === 0) {
        const source = await api.addTextSource(auth.csrfToken, currentReview.id, proposal);
        setSources((current) => [source, ...current]);
      }
      const run = await api.startRun(auth.csrfToken, currentReview.id);
      await refreshUsage();
      navigate(`/runs/${run.id}`);
    } catch (err) {
      setError((err as Error).message);
      await refreshUsage();
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>New review</h1>
          <p className="muted">Use any source material, inspect routing, then run the structured decision workflow.</p>
        </div>
        <Status tone={review ? 'ok' : 'info'}>{review ? 'Review created' : 'Draft'}</Status>
        {usage ? (
          <Status tone={usage.runs_remaining_today > 0 ? 'ok' : 'warn'}>
            {usage.runs_remaining_today} runs left today
          </Status>
        ) : null}
      </div>
      <div className="grid">
        <div className="stack">
          <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
            <Field label="Title">
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Proposal">
              <textarea rows={7} value={proposal} onChange={(event) => setProposal(event.target.value)} />
            </Field>
            <div className="row">
              <Field label="Mode">
                <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="in_depth">In-depth</option>
                </select>
              </Field>
              <Field label="Focus chips">
                <input value={focus} onChange={(event) => setFocus(event.target.value)} />
              </Field>
            </div>
            <ErrorState message={error} />
            <div className="row">
              <Button type="button" variant="primary" onClick={createReview}>Create review</Button>
            </div>
          </form>
          <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
            <div className="section-title">
              <BookOpen size={18} />
              <h2>Context packs</h2>
            </div>
            <div className="row">
              <Field label="Context pack name">
                <input value={contextName} onChange={(event) => setContextName(event.target.value)} />
              </Field>
              <Field label="Agent">
                <select value={contextAgent} onChange={(event) => setContextAgent(event.target.value)}>
                  {AGENT_OPTIONS.map(([key, label]) => (
                    <option value={key} key={key}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Markdown">
              <textarea rows={5} value={contextMarkdown} onChange={(event) => setContextMarkdown(event.target.value)} />
            </Field>
            <ErrorState message={contextError} />
            {contextMessage ? <p className="muted" role="status">{contextMessage}</p> : null}
            <div className="row">
              <Button
                type="button"
                onClick={addContextPack}
                disabled={!contextName.trim() || !contextMarkdown.trim()}
              >
                Add context pack
              </Button>
            </div>
            {contextPacks.length === 0 ? (
              <EmptyState title="No context packs yet" body="Create a Markdown pack for an agent." />
            ) : (
              <div className="list">
                {contextPacks.map((pack) => (
                  <article className="list-item" key={pack.id}>
                    <div className="stack">
                      <strong>{pack.name}</strong>
                      <span className="muted">{preview(pack.markdown)}</span>
                      <div className="row">
                        <Status tone="info">{pack.agent_key}</Status>
                        <Status tone="ok">Version {pack.version}</Status>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </form>
          <Stage2ReviewSettings
            externalResearch={externalResearch}
            privateResearch={privateResearch}
            allowlist={allowlist}
            blocklist={blocklist}
            onExternalResearch={setExternalResearch}
            onPrivateResearch={setPrivateResearch}
            onAllowlist={setAllowlist}
            onBlocklist={setBlocklist}
          />
        </div>
        <aside className="stack">
          <SourceIntakePanel
            disabled={!review}
            sources={sources}
            error={sourceError}
            onAddText={addText}
            onUpload={upload}
            onWebsite={addWebsite}
            onRepository={addRepository}
          />
          <section className="panel stack" aria-labelledby="preflight-heading">
          <h2 id="preflight-heading">Preflight</h2>
          <div className="row">
            <Button type="button" onClick={runPreflight} disabled={!review}><ShieldQuestion size={16} /> Preflight</Button>
            <Button
              type="button"
              variant="primary"
              onClick={startRun}
              disabled={starting || !title.trim() || !proposal.trim() || usage?.runs_remaining_today === 0}
            >
              <Play size={16} /> {starting ? 'Starting' : 'Run review'}
            </Button>
          </div>
          {preflight ? (
            <pre className="panel">{JSON.stringify(preflight, null, 2)}</pre>
          ) : (
            <p className="muted">Preflight shows sources, selected agents, exclusions, provider route and warnings.</p>
          )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function preview(markdown: string) {
  const firstLine = markdown.split(/\r?\n/).find((line) => line.trim());
  return firstLine ? firstLine.replace(/^#+\s*/, '') : 'Markdown context';
}

function toList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

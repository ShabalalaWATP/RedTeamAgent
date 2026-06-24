import { BookOpen, FileUp, Play, ShieldQuestion } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { ContextPack, Review, Source } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';

const DEFAULT_PROPOSAL = 'Adopt the proposal with staged validation, named owners, evidence checks and rollback criteria.';
const DEFAULT_CONTEXT = '# Governance\nUse source-linked claims and show assumptions.';
const AGENT_OPTIONS = [
  { key: 'policy_governance', label: 'Policy governance' },
  { key: 'cybersecurity_privacy', label: 'Cybersecurity privacy' },
  { key: 'operations_delivery', label: 'Operations delivery' },
  { key: 'product_user_experience', label: 'Product user experience' },
  { key: 'alternative_perspectives', label: 'Alternative perspectives' }
];

export function NewReviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [title, setTitle] = useState('Decision readiness review');
  const [proposal, setProposal] = useState(DEFAULT_PROPOSAL);
  const [mode, setMode] = useState<'basic' | 'standard' | 'in_depth'>('standard');
  const [focus, setFocus] = useState('security, policy, UX');
  const [review, setReview] = useState<Review | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [contextPacks, setContextPacks] = useState<ContextPack[]>([]);
  const [contextName, setContextName] = useState('Stage 1 governance context');
  const [contextAgent, setContextAgent] = useState('policy_governance');
  const [contextMarkdown, setContextMarkdown] = useState(DEFAULT_CONTEXT);
  const [contextMessage, setContextMessage] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      ignore = true;
    };
  }, [auth]);

  const createReview = async () => {
    if (!auth || !projectId) return;
    setError(null);
    try {
      const next = await api.createReview(auth.csrfToken, projectId, {
        title,
        proposal_text: proposal,
        mode,
        focus_chips: focus.split(',').map((chip) => chip.trim()).filter(Boolean)
      });
      setReview(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addText = async () => {
    /* v8 ignore next -- the add-text button is disabled until a review exists. */
    if (!auth || !review) return;
    const source = await api.addTextSource(auth.csrfToken, review.id, proposal);
    setSources((current) => [source, ...current]);
  };

  const upload = async (file: File | undefined) => {
    /* v8 ignore next -- uploads are ignored until a review and file are present. */
    if (!auth || !review || !file) return;
    const source = await api.uploadSource(auth.csrfToken, review.id, file);
    setSources((current) => [source, ...current]);
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
    /* v8 ignore next -- the run button is disabled until a review exists. */
    if (!auth || !review) return;
    const run = await api.startRun(auth.csrfToken, review.id);
    navigate(`/runs/${run.id}`);
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>New review</h1>
          <p className="muted">Use any source material, inspect routing, then run the structured decision workflow.</p>
        </div>
        <Status tone={review ? 'ok' : 'info'}>{review ? 'Review created' : 'Draft'}</Status>
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
              <Button type="button" onClick={addText} disabled={!review}>Add pasted text</Button>
            </div>
            <Field label="Upload TXT, Markdown, PDF or DOCX">
              <input type="file" onChange={(event) => void upload(event.target.files?.[0])} />
            </Field>
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
                  {AGENT_OPTIONS.map((agent) => (
                    <option value={agent.key} key={agent.key}>{agent.label}</option>
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
        </div>
        <aside className="panel stack">
          <h2>Sources and preflight</h2>
          {sources.length === 0 ? (
            <EmptyState title="No evidence yet" body="Add text or upload a supported document." />
          ) : (
            <div className="list">
              {sources.map((source) => (
                <article className="list-item" key={source.id}>
                  <span><FileUp size={16} /> {source.filename}</span>
                  <Status tone={source.state === 'ingested' ? 'ok' : 'bad'}>{source.state}</Status>
                </article>
              ))}
            </div>
          )}
          <div className="row">
            <Button type="button" onClick={runPreflight} disabled={!review}><ShieldQuestion size={16} /> Preflight</Button>
            <Button type="button" variant="primary" onClick={startRun} disabled={!review}><Play size={16} /> Run review</Button>
          </div>
          {preflight ? (
            <pre className="panel">{JSON.stringify(preflight, null, 2)}</pre>
          ) : (
            <p className="muted">Preflight shows sources, selected agents, exclusions, provider route and warnings.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function preview(markdown: string) {
  const firstLine = markdown.split(/\r?\n/).find((line) => line.trim());
  return firstLine ? firstLine.replace(/^#+\s*/, '') : 'Markdown context';
}

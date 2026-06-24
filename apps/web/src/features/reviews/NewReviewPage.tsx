import { FileUp, Play, ShieldQuestion } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { Review, Source } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';

const DEFAULT_PROPOSAL = 'Launch the new checkout provider with staged rollout, support coverage and rollback plan.';

export function NewReviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [title, setTitle] = useState('Checkout provider migration');
  const [proposal, setProposal] = useState(DEFAULT_PROPOSAL);
  const [mode, setMode] = useState<'basic' | 'standard' | 'in_depth'>('standard');
  const [focus, setFocus] = useState('security, policy, UX');
  const [review, setReview] = useState<Review | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [preflight, setPreflight] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!auth || !review) return;
    const source = await api.addTextSource(auth.csrfToken, review.id, proposal);
    setSources((current) => [source, ...current]);
  };

  const upload = async (file: File | undefined) => {
    if (!auth || !review || !file) return;
    const source = await api.uploadSource(auth.csrfToken, review.id, file);
    setSources((current) => [source, ...current]);
  };

  const addContextPack = async () => {
    if (!auth) return;
    await api.createContextPack(auth.csrfToken, {
      workspace_id: auth.workspaceId,
      name: 'Stage 1 governance context',
      agent_key: 'policy_governance',
      markdown: '# Governance\nUse source-linked claims and show assumptions.'
    });
  };

  const runPreflight = async () => {
    if (!review) return;
    setPreflight(await api.preflight(review.id));
  };

  const startRun = async () => {
    if (!auth || !review) return;
    const run = await api.startRun(auth.csrfToken, review.id);
    navigate(`/runs/${run.id}`);
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>New review</h1>
          <p className="muted">Create the evidence pack, inspect routing, then run the structured workflow.</p>
        </div>
        <Status tone={review ? 'ok' : 'info'}>{review ? 'Review created' : 'Draft'}</Status>
      </div>
      <div className="grid">
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
            <Button type="button" onClick={addContextPack}>Add context pack</Button>
          </div>
          <Field label="Upload TXT, Markdown, PDF or DOCX">
            <input type="file" onChange={(event) => void upload(event.target.files?.[0])} />
          </Field>
        </form>
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

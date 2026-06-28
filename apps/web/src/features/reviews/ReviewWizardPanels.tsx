import { BookOpen, Play } from 'lucide-react';
import { AGENT_OPTIONS } from '../../shared/agentOptions';
import type { ContextPack, UsageLimits } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';

type ReviewSetupStepProps = {
  title: string;
  proposal: string;
  mode: 'basic' | 'standard' | 'in_depth';
  focus: string;
  onTitle: (value: string) => void;
  onProposal: (value: string) => void;
  onMode: (value: 'basic' | 'standard' | 'in_depth') => void;
  onFocus: (value: string) => void;
};

export function ReviewSetupStep({
  title,
  proposal,
  mode,
  focus,
  onTitle,
  onProposal,
  onMode,
  onFocus
}: ReviewSetupStepProps) {
  return (
    <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
      <div className="section-title">
        <h2>Review setup</h2>
      </div>
      <p className="muted">Fill this in first. Sources, context, research policy and the run button unlock after this stage.</p>
      <Field label="Title">
        <input value={title} onChange={(event) => onTitle(event.target.value)} />
      </Field>
      <Field label="Proposal">
        <textarea rows={7} value={proposal} onChange={(event) => onProposal(event.target.value)} />
      </Field>
      <div className="row">
        <Field label="Mode">
          <select value={mode} onChange={(event) => onMode(event.target.value as typeof mode)}>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="in_depth">In-depth</option>
          </select>
        </Field>
        <Field label="Focus chips">
          <input value={focus} onChange={(event) => onFocus(event.target.value)} />
        </Field>
      </div>
    </form>
  );
}

type ContextPackStepProps = {
  contextAgent: string;
  contextError: string | null;
  contextMarkdown: string;
  contextMessage: string | null;
  contextName: string;
  contextPacks: ContextPack[];
  onAddContextPack: () => Promise<void>;
  onContextAgent: (value: string) => void;
  onContextMarkdown: (value: string) => void;
  onContextName: (value: string) => void;
};

export function ContextPackStep({
  contextAgent,
  contextError,
  contextMarkdown,
  contextMessage,
  contextName,
  contextPacks,
  onAddContextPack,
  onContextAgent,
  onContextMarkdown,
  onContextName
}: ContextPackStepProps) {
  return (
    <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
      <div className="section-title">
        <BookOpen size={18} />
        <h2>Context packs</h2>
        <Status tone="info">Optional</Status>
      </div>
      <p className="muted">Add specialist background only if it helps this review. Leave it blank and use Next stage to skip.</p>
      <div className="row">
        <Field label="Context pack name">
          <input value={contextName} onChange={(event) => onContextName(event.target.value)} />
        </Field>
        <Field label="Agent">
          <select value={contextAgent} onChange={(event) => onContextAgent(event.target.value)}>
            {AGENT_OPTIONS.map(([key, label]) => (
              <option value={key} key={key}>{label}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Markdown">
        <textarea rows={5} value={contextMarkdown} onChange={(event) => onContextMarkdown(event.target.value)} />
      </Field>
      <ErrorState message={contextError} />
      {contextMessage ? <p className="muted" role="status">{contextMessage}</p> : null}
      <div className="row">
        <Button
          type="button"
          onClick={() => void onAddContextPack()}
          disabled={!contextName.trim() || !contextMarkdown.trim()}
        >
          Add context pack
        </Button>
      </div>
      {contextPacks.length === 0 ? (
        <EmptyState title="No context packs yet" body="Optional packs can be added later from this stage." />
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
  );
}

type RunReviewStepProps = {
  contextPackCount: number;
  disabled: boolean;
  onRun: () => Promise<void>;
  sourceCount: number;
  starting: boolean;
  usage: UsageLimits | null;
};

export function RunReviewStep({
  contextPackCount,
  disabled,
  onRun,
  sourceCount,
  starting,
  usage
}: RunReviewStepProps) {
  return (
    <section className="panel stack run-review-panel" aria-labelledby="run-review-heading">
      <h2 id="run-review-heading">Run review</h2>
      <p className="muted">Setup, sources, optional context and research policy are ready. Start the scan from here.</p>
      <div className="row">
        <Status tone={sourceCount > 0 ? 'ok' : 'info'}>
          {sourceCount > 0 ? `${sourceCount} source${sourceCount === 1 ? '' : 's'} added` : 'Proposal text will be used'}
        </Status>
        <Status tone={contextPackCount > 0 ? 'ok' : 'info'}>
          {contextPackCount > 0 ? `${contextPackCount} context pack${contextPackCount === 1 ? '' : 's'}` : 'No context packs'}
        </Status>
        {usage ? <Status tone={disabled ? 'warn' : 'ok'}>{workflowQuotaLabel(usage)}</Status> : null}
      </div>
      <Button
        type="button"
        variant="primary"
        className="run-review-button"
        onClick={() => void onRun()}
        disabled={starting || disabled}
      >
        <Play size={20} /> {starting ? 'Starting review' : 'Run review'}
      </Button>
    </section>
  );
}

type StageActionsProps = {
  canGoBack: boolean;
  canGoNext: boolean;
  isFinalStage: boolean;
  onBack: () => void;
  onNext: () => void;
};

export function StageActions({ canGoBack, canGoNext, isFinalStage, onBack, onNext }: StageActionsProps) {
  return (
    <div className="stage-actions">
      <Button type="button" onClick={onBack} disabled={!canGoBack}>
        Previous stage
      </Button>
      {!isFinalStage ? (
        <Button type="button" variant="primary" onClick={onNext} disabled={!canGoNext}>
          Next stage
        </Button>
      ) : null}
    </div>
  );
}

function preview(markdown: string) {
  const firstLine = markdown.split(/\r?\n/).find((line) => line.trim());
  return firstLine ? firstLine.replace(/^#+\s*/, '') : 'Markdown context';
}

function workflowQuotaLabel(usage: UsageLimits) {
  if (usage.workflow_weekly_limit === null && usage.workflow_total_limit === null) {
    return 'Unlimited workflows';
  }
  return `${remainingLabel(usage.weekly_workflows_remaining)} left this week, ${remainingLabel(usage.workflows_remaining)} saved slots`;
}

function remainingLabel(value: number | null) {
  return value === null ? 'unlimited' : String(value);
}

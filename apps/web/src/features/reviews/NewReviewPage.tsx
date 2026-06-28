import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { ContextPack, Review, Source, UsageLimits } from '../../shared/types';
import { BackButton, ErrorState, Status } from '../../shared/ui';
import { ContextPackStep, ReviewSetupStep, RunReviewStep, StageActions } from './ReviewWizardPanels';
import { ReviewWizardSteps } from './ReviewWizardSteps';
import { SourceIntakePanel } from './SourceIntakePanel';
import { Stage2ReviewSettings } from './Stage2ReviewSettings';
import { REVIEW_STAGES, nextReviewStage, previousReviewStage } from './reviewStages';
import type { ReviewStage } from './reviewStages';

const DEFAULT_PROPOSAL = 'Adopt the proposal with staged validation, named owners, evidence checks and rollback criteria.';
const DEFAULT_CONTEXT = '# Governance\nUse source-linked claims and show assumptions.';

export function NewReviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [stage, setStage] = useState<ReviewStage>('setup');
  const [maxStageIndex, setMaxStageIndex] = useState(0);
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
  const [usage, setUsage] = useState<UsageLimits | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const reviewRef = useRef<Review | null>(null);
  const creatingReviewRef = useRef<Promise<Review> | null>(null);
  const setupReady = Boolean(title.trim()) && Boolean(proposal.trim());
  const currentStageIndex = REVIEW_STAGES.indexOf(stage);
  const completedStages = REVIEW_STAGES.slice(0, maxStageIndex);

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

  const reviewBody = () => ({
    title: reviewTitle(title),
    proposal_text: reviewProposal(proposal),
    mode,
    focus_chips: toList(focus),
    external_research: externalResearch,
    private_research: privateResearch,
    domain_allowlist: toList(allowlist),
    domain_blocklist: toList(blocklist)
  });

  const createReviewDraft = async () => {
    if (!auth) throw new Error('Session is missing.');
    if (reviewRef.current) return reviewRef.current;
    if (creatingReviewRef.current) return creatingReviewRef.current;
    const body = reviewBody();
    const creating = (projectId
      ? api.createReview(auth.csrfToken, projectId, body)
      : api.createStandaloneReview(auth.csrfToken, auth.workspaceId, body)
    ).then((next) => {
      reviewRef.current = next;
      setReview(next);
      return next;
    });
    creatingReviewRef.current = creating;
    try {
      return await creating;
    } finally {
      if (creatingReviewRef.current === creating) creatingReviewRef.current = null;
    }
  };

  const syncReviewDraft = async () => {
    if (!auth) throw new Error('Session is missing.');
    const currentReview = await createReviewDraft();
    const updated = await api.updateReview(auth.csrfToken, currentReview.id, reviewBody());
    reviewRef.current = updated;
    setReview(updated);
    return updated;
  };

  const addText = async () => {
    await addSource((currentReview, csrf) => api.addTextSource(csrf, currentReview.id, reviewProposal(proposal)));
  };

  const upload = async (file: File) => {
    await addSource((currentReview, csrf) => api.uploadSource(csrf, currentReview.id, file));
  };

  const addWebsite = async (url: string) => {
    await addSource((currentReview, csrf) => api.addWebsiteSource(csrf, currentReview.id, url.trim()));
  };

  const addRepository = async (url: string) => {
    await addSource((currentReview, csrf) => api.addRepositorySource(csrf, currentReview.id, url.trim()));
  };

  const addSource = async (operation: (currentReview: Review, csrf: string) => Promise<Source>) => {
    setSourceError(null);
    try {
      if (!auth) throw new Error('Sign in to add evidence.');
      const currentReview = await createReviewDraft();
      const source = await operation(currentReview, auth.csrfToken);
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

  const startRun = async () => {
    /* v8 ignore next -- the app layout prevents unauthenticated rendering of this route. */
    if (!auth) return;
    setError(null);
    setSourceError(null);
    setStarting(true);
    try {
      const currentReview = await syncReviewDraft();
      if (sources.length === 0) {
        const source = await api.addTextSource(auth.csrfToken, currentReview.id, reviewProposal(proposal));
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

  const canSelectStage = (candidate: ReviewStage) => REVIEW_STAGES.indexOf(candidate) <= maxStageIndex;

  const selectStage = (candidate: ReviewStage) => {
    if (canSelectStage(candidate)) setStage(candidate);
  };

  const goToNextStage = () => {
    if (stage === 'setup' && !setupReady) {
      setError('Add a title and proposal before continuing.');
      return;
    }
    setError(null);
    const next = nextReviewStage(stage);
    const nextIndex = REVIEW_STAGES.indexOf(next);
    setMaxStageIndex((current) => Math.max(current, nextIndex));
    setStage(next);
  };

  const goToPreviousStage = () => {
    setError(null);
    setStage(previousReviewStage(stage));
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>New review</h1>
          <p className="muted">Use any source material, inspect routing, then run the structured decision workflow.</p>
        </div>
        <div className="screen-actions">
          <BackButton fallback={projectId ? '/projects' : '/workflows'} />
          <Status tone={review ? 'ok' : 'info'}>{review ? 'Review created' : 'Draft'}</Status>
          <Status tone="info">{projectId ? 'Project workflow' : 'Standalone workflow'}</Status>
          {usage ? (
            <Status tone={isWorkflowQuotaBlocked(usage) ? 'warn' : 'ok'}>
              {workflowQuotaLabel(usage)}
            </Status>
          ) : null}
        </div>
      </div>
      <div className="review-wizard stack">
        <ReviewWizardSteps
          canSelect={canSelectStage}
          current={stage}
          completed={completedStages}
          onSelect={selectStage}
        />
        <ErrorState message={error} />
        {stage === 'setup' ? (
          <ReviewSetupStep
            title={title}
            proposal={proposal}
            mode={mode}
            focus={focus}
            onTitle={setTitle}
            onProposal={setProposal}
            onMode={setMode}
            onFocus={setFocus}
          />
        ) : null}
        {stage === 'sources' ? (
          <SourceIntakePanel
            disabled={!auth || starting || isWorkflowQuotaBlocked(usage)}
            sources={sources}
            error={sourceError}
            onAddText={addText}
            onUpload={upload}
            onWebsite={addWebsite}
            onRepository={addRepository}
          />
        ) : null}
        {stage === 'context' ? (
          <ContextPackStep
            contextAgent={contextAgent}
            contextError={contextError}
            contextMarkdown={contextMarkdown}
            contextMessage={contextMessage}
            contextName={contextName}
            contextPacks={contextPacks}
            onAddContextPack={addContextPack}
            onContextAgent={setContextAgent}
            onContextMarkdown={setContextMarkdown}
            onContextName={setContextName}
          />
        ) : null}
        {stage === 'research' ? (
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
        ) : null}
        {stage === 'run' ? (
          <RunReviewStep
            contextPackCount={contextPacks.length}
            disabled={isWorkflowQuotaBlocked(usage)}
            onRun={startRun}
            sourceCount={sources.length}
            starting={starting}
            usage={usage}
          />
        ) : null}
        <StageActions
          canGoBack={currentStageIndex > 0}
          canGoNext
          isFinalStage={stage === 'run'}
          onBack={goToPreviousStage}
          onNext={goToNextStage}
        />
      </div>
    </section>
  );
}

function toList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function reviewTitle(value: string) {
  return value.trim() || 'Untitled review';
}

function reviewProposal(value: string) {
  return value.trim() || 'Review the supplied evidence and identify risks, assumptions, blockers and practical next steps.';
}

function isWorkflowQuotaBlocked(usage: UsageLimits | null) {
  return usage?.weekly_workflows_remaining === 0 || usage?.workflows_remaining === 0;
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

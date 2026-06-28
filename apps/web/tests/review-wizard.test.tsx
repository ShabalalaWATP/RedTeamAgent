import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewWizardSteps } from '../src/features/reviews/ReviewWizardSteps';
import { RunReviewStep } from '../src/features/reviews/ReviewWizardPanels';
import { nextReviewStage, previousReviewStage } from '../src/features/reviews/reviewStages';
import { jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('review wizard', () => {
  it('guards setup before sources and lets users go back', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/context-packs?')) return jsonResponse([]);
      if (url.includes('/usage/limits')) return jsonResponse(usageLimits());
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/projects/project-1/reviews/new');
    await user.clear(screen.getByLabelText(/^proposal$/i));
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a title and proposal before continuing.');

    await user.type(screen.getByLabelText(/^proposal$/i), 'Assess the deployment plan.');
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    expect(await screen.findByRole('heading', { name: 'Sources and snapshots' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /stage 1/i }));
    expect(screen.getByRole('heading', { name: 'Review setup' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    await user.click(screen.getByRole('button', { name: /previous stage/i }));
    expect(screen.getByRole('heading', { name: 'Review setup' })).toBeInTheDocument();
  });

  it('allows enabled wizard steps to be selected', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ReviewWizardSteps
        canSelect={(stage) => stage === 'setup' || stage === 'sources'}
        current="sources"
        completed={['setup']}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole('button', { name: /stage 1/i }));
    expect(onSelect).toHaveBeenCalledWith('setup');
    expect(screen.getByRole('button', { name: /stage 3/i })).toBeDisabled();
  });

  it('renders final run labels for unlimited usage and existing context', () => {
    render(
      <RunReviewStep
        contextPackCount={2}
        disabled={false}
        onRun={async () => undefined}
        sourceCount={0}
        starting={false}
        usage={{
          account_type: 'owner',
          tier_name: 'Owner',
          project_limit: null,
          projects_used: 0,
          projects_remaining: null,
          workflow_total_limit: null,
          workflows_used: 0,
          workflows_remaining: null,
          workflow_weekly_limit: null,
          workflows_started_this_week: 0,
          weekly_workflows_remaining: null,
          daily_review_run_limit: null,
          runs_started_today: 0,
          runs_remaining_today: null,
          resets_at: '2026-06-25T00:00:00Z'
        }}
      />
    );

    expect(screen.getByText('Proposal text will be used')).toBeInTheDocument();
    expect(screen.getByText('2 context packs')).toBeInTheDocument();
    expect(screen.getByText('Unlimited workflows')).toBeInTheDocument();
  });

  it('renders singular run labels without usage data', () => {
    render(
      <RunReviewStep
        contextPackCount={1}
        disabled={false}
        onRun={async () => undefined}
        sourceCount={1}
        starting
        usage={null}
      />
    );

    expect(screen.getByText('1 source added')).toBeInTheDocument();
    expect(screen.getByText('1 context pack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /starting review/i })).toBeDisabled();
  });

  it('keeps stage helper functions inside the wizard bounds', () => {
    expect(previousReviewStage('setup')).toBe('setup');
    expect(nextReviewStage('run')).toBe('run');
  });
});

function usageLimits() {
  return {
    account_type: 'user',
    tier_name: 'User',
    project_limit: 5,
    projects_used: 0,
    projects_remaining: 5,
    workflow_total_limit: 20,
    workflows_used: 0,
    workflows_remaining: 20,
    workflow_weekly_limit: 10,
    workflows_started_this_week: 0,
    weekly_workflows_remaining: 10,
    daily_review_run_limit: 10,
    runs_started_today: 0,
    runs_remaining_today: 10,
    resets_at: '2026-06-25T00:00:00Z'
  };
}

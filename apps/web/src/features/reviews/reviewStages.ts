export type ReviewStage = 'setup' | 'sources' | 'context' | 'research' | 'run';

export const REVIEW_STAGES: ReviewStage[] = ['setup', 'sources', 'context', 'research', 'run'];

export function nextReviewStage(stage: ReviewStage) {
  return REVIEW_STAGES[Math.min(REVIEW_STAGES.indexOf(stage) + 1, REVIEW_STAGES.length - 1)];
}

export function previousReviewStage(stage: ReviewStage) {
  return REVIEW_STAGES[Math.max(REVIEW_STAGES.indexOf(stage) - 1, 0)];
}

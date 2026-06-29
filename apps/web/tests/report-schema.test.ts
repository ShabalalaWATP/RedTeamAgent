import { describe, expect, it } from 'vitest';
import { reportSchema } from '../src/api/schemas';
import { reportResponse } from './report-fixtures';

describe('reportSchema', () => {
  it('preserves structured agent and orchestrator report data', () => {
    const parsed = reportSchema.parse({
      data: {
        ...reportResponse(),
        orchestrator_narrative: {
          likely_user_intent: 'Understand whether the plan will work.',
          synthesis: 'The plan needs sharper ownership.',
          agents_run: ['Operations and Delivery Agent'],
          what_will_work: ['A reversible pilot.'],
          what_will_not_work: ['A broad launch with vague evidence.'],
          top_decision_points: ['Owner needed'],
          recommended_plan: ['Assign owner']
        }
      }
    }).data;

    expect(parsed.llm_review?.agent_outputs[0].label).toBe('Operations and Delivery Agent');
    expect(parsed.llm_review?.agent_outputs[0].claims[0].title).toBe('Owner needed');
    expect(parsed.orchestrator_narrative?.recommended_plan).toEqual(['Assign owner']);
  });
});

import { Check } from 'lucide-react';
import type { ReviewStage } from './reviewStages';
import './reviewWizard.css';

type ReviewWizardStepsProps = {
  canSelect: (stage: ReviewStage) => boolean;
  current: ReviewStage;
  completed: ReviewStage[];
  onSelect: (stage: ReviewStage) => void;
};

const STEPS: Array<{ key: ReviewStage; label: string; optional?: boolean }> = [
  { key: 'setup', label: 'Setup' },
  { key: 'sources', label: 'Sources' },
  { key: 'context', label: 'Context', optional: true },
  { key: 'research', label: 'Research' },
  { key: 'run', label: 'Run' },
];

export function ReviewWizardSteps({ canSelect, current, completed, onSelect }: ReviewWizardStepsProps) {
  return (
    <nav className="wizard-steps" aria-label="Review stages">
      {STEPS.map((step, index) => {
        const isCurrent = step.key === current;
        const isComplete = completed.includes(step.key);
        const status = isComplete ? 'complete' : isCurrent ? 'current' : 'pending';
        return (
          <button
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`Stage ${index + 1}: ${step.label}${step.optional ? ' (optional)' : ''}`}
            className={`wizard-step is-${status}`}
            disabled={!canSelect(step.key)}
            key={step.key}
            onClick={() => onSelect(step.key)}
            type="button"
          >
            <span className="wizard-node" aria-hidden="true">
              {isComplete ? <Check size={18} strokeWidth={3} /> : index + 1}
            </span>
            <span className="wizard-step-text" aria-hidden="true">
              <span className="wizard-step-label">{step.label}</span>
              {step.optional ? <small>Optional</small> : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

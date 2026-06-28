import { CheckCircle2, Circle } from 'lucide-react';
import type { ReviewStage } from './reviewStages';

type ReviewWizardStepsProps = {
  canSelect: (stage: ReviewStage) => boolean;
  current: ReviewStage;
  completed: ReviewStage[];
  onSelect: (stage: ReviewStage) => void;
};

const STEPS: Array<{ key: ReviewStage; label: string; optional?: boolean }> = [
  { key: 'setup', label: 'Review setup' },
  { key: 'sources', label: 'Sources' },
  { key: 'context', label: 'Context', optional: true },
  { key: 'research', label: 'Research policy' },
  { key: 'run', label: 'Run' },
];

export function ReviewWizardSteps({ canSelect, current, completed, onSelect }: ReviewWizardStepsProps) {
  return (
    <nav className="wizard-steps" aria-label="Review stages">
      {STEPS.map((step, index) => {
        const isCurrent = step.key === current;
        const isComplete = completed.includes(step.key);
        return (
          <button
            aria-current={isCurrent ? 'step' : undefined}
            className={`wizard-step ${isCurrent ? 'current' : ''}`}
            disabled={!canSelect(step.key)}
            key={step.key}
            onClick={() => onSelect(step.key)}
            type="button"
          >
            {isComplete ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            <span>Stage {index + 1}: {step.label}</span>
            {step.optional ? <small>Optional</small> : null}
          </button>
        );
      })}
    </nav>
  );
}

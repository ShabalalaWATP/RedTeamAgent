import './reportProgress.css';

export type RunEvent = {
  id: string;
  state: string;
  message: string;
  sequence: number;
  created_at?: string;
};

type RunProgressPanelProps = {
  events: RunEvent[];
  runState?: string;
};

const RUN_STAGES = [
  ['intake', 'Intake'],
  ['ingestion', 'Evidence ingestion'],
  ['framing', 'Review framing'],
  ['agent_planning', 'Agent planning'],
  ['specialist_review', 'LLM specialist review'],
  ['reconciliation', 'Reconciliation'],
  ['report_composition', 'Report composition'],
  ['quality_gate', 'Quality gate']
] as const;

const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
const STAGE_LABELS = Object.fromEntries([
  ...RUN_STAGES,
  ['completed', 'Completed'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled']
]);

export function stageLabel(state: string | undefined) {
  if (!state) return 'Loading';
  return STAGE_LABELS[state] ?? state;
}

export function RunProgressPanel({ events, runState }: RunProgressPanelProps) {
  const latestEvent = events.at(-1);
  const currentState = latestEvent?.state ?? runState;
  const currentIndex = stageIndex(currentState);
  const progress = progressPercent(runState, currentState, currentIndex);
  const specialistUpdates = events.filter((event) => (
    event.state === 'specialist_review' && /Agent returned/.test(event.message)
  ));
  const elapsed = elapsedLabel(events[0]?.created_at, latestEvent?.created_at);
  const latestUpdate = timeLabel(latestEvent?.created_at);
  const status = statusLabel(runState, currentState, currentIndex);

  return (
    <div className="run-progress" aria-label="Run progress summary">
      <div className="run-progress-header">
        <div>
          <span className="report-reco-label">Review progress</span>
          <strong>{status}</strong>
        </div>
        <span>{progress}%</span>
      </div>
      <progress aria-label="Review progress" max={100} value={progress} />
      <div className="run-progress-meta">
        <span>{elapsed}</span>
        <span>{latestUpdate}</span>
      </div>
      {latestEvent?.message ? <p className="muted">{latestEvent.message}</p> : null}
      {specialistUpdates.length > 0 && !TERMINAL_STATES.has(runState ?? '') ? (
        <p className="muted">{specialistUpdates.length} specialist agent update(s) received.</p>
      ) : null}
      <ol className="run-stage-list">
        {RUN_STAGES.map(([key, label], index) => {
          const state = itemState(runState, currentState, currentIndex, index);
          return (
            <li className={`is-${state}`} key={key} aria-current={state === 'current' ? 'step' : undefined}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function stageIndex(state: string | undefined) {
  return RUN_STAGES.findIndex(([key]) => key === state);
}

function progressPercent(runState: string | undefined, currentState: string | undefined, currentIndex: number) {
  if (runState === 'completed' || currentState === 'completed') return 100;
  if (currentIndex < 0) return 0;
  return Math.round((currentIndex / RUN_STAGES.length) * 100);
}

function itemState(
  runState: string | undefined,
  currentState: string | undefined,
  currentIndex: number,
  index: number
) {
  if (runState === 'completed' || currentState === 'completed') return 'complete';
  if (TERMINAL_STATES.has(runState ?? '') && index === currentIndex) return 'stopped';
  if (index < currentIndex) return 'complete';
  if (index === currentIndex) return 'current';
  return 'pending';
}

function statusLabel(runState: string | undefined, currentState: string | undefined, currentIndex: number) {
  if (runState === 'completed' || currentState === 'completed') return 'Completed';
  if (runState === 'failed') return 'Failed';
  if (runState === 'cancelled') return 'Cancelled';
  if (currentIndex >= 0) return `Stage ${currentIndex + 1} of ${RUN_STAGES.length}: ${stageLabel(currentState)}`;
  return stageLabel(currentState);
}

function elapsedLabel(first: string | undefined, latest: string | undefined) {
  const start = parsedTime(first);
  const end = parsedTime(latest);
  if (start === null || end === null || end < start) return 'Elapsed time pending';
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s elapsed`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s elapsed`;
}

function timeLabel(value: string | undefined) {
  const timestamp = parsedTime(value);
  if (timestamp === null) return 'Waiting for first update';
  return `Last update ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function parsedTime(value: string | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

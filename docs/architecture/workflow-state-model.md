# Stage 1 Workflow State Model

Review runs move through deterministic states:

```mermaid
stateDiagram-v2
  [*] --> intake
  intake --> ingestion
  ingestion --> framing
  framing --> agent_planning
  agent_planning --> specialist_review
  specialist_review --> reconciliation
  reconciliation --> report_composition
  report_composition --> quality_gate
  quality_gate --> completed
  intake --> failed
  ingestion --> failed
  framing --> failed
  agent_planning --> failed
  specialist_review --> failed
  reconciliation --> failed
  report_composition --> failed
  quality_gate --> failed
  intake --> cancelled
  ingestion --> cancelled
  framing --> cancelled
  agent_planning --> cancelled
  specialist_review --> cancelled
  reconciliation --> cancelled
  report_composition --> cancelled
```

Starting a run persists an `intake` run and queues background execution. The executor commits each state transition and checks for cancellation before advancing, so a queued or in-flight run can stop before report creation.

Events are persisted to `RunEvent` before they are streamed, so refreshing the running screen can replay the timeline.
